/**
 * V3 text content schemas & helpers — canonical source of truth.
 *
 * Phase 2: copied from legacy/nodes/text.ts → V3 now owns these definitions.
 * Node-level text type (TextNodeV3) lives in v3/nodes/text.ts.
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  LocaleIdentifierSchema,
} from "../common";

// ── Text segmentation ─────────────────────────────────────────────────

export function segmentTextUnits(
  text: string,
  unit: "grapheme" | "word" | "line",
  locale = "vi",
): string[] {
  if (unit === "line") return text.split(/\r?\n/);
  const segments = [
    ...new Intl.Segmenter(locale, { granularity: unit }).segment(text),
  ];
  return unit === "word"
    ? segments
        .map((segment) => segment.segment)
        .filter((segment) => segment.trim().length > 0)
    : segments.map((segment) => segment.segment);
}

// ── Rich text ─────────────────────────────────────────────────────────

const RunHighlightSchema = z
  .object({
    fill: z.string().min(1),
    paddingX: FiniteNumberSchema.nonnegative()
      .max(MOTION_V2_LIMITS.richTextHighlightPadding)
      .optional(),
    paddingY: FiniteNumberSchema.nonnegative()
      .max(MOTION_V2_LIMITS.richTextHighlightPadding)
      .optional(),
    radius: FiniteNumberSchema.nonnegative()
      .max(MOTION_V2_LIMITS.richTextHighlightPadding)
      .optional(),
  })
  .strict();

const RichTextRunStyleSchema = z
  .object({
    fill: z.string().min(1).optional(),
    fontAssetId: IdSchema.optional(),
    fontWeight: FiniteNumberSchema.int().min(1).max(1000).optional(),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    fontScale: FiniteNumberSchema.positive()
      .max(MOTION_V2_LIMITS.richTextFontScale)
      .optional(),
    letterSpacing: FiniteNumberSchema.optional(),
    highlight: RunHighlightSchema.optional(),
  })
  .strict();

export const RichTextRunSchema = z
  .object({
    id: IdSchema,
    text: z.string(),
    style: RichTextRunStyleSchema.optional(),
  })
  .strict();

export const TextContentPlainSchema = z
  .object({ kind: z.literal("plain"), text: z.string() })
  .strict();

export const TextContentRunsSchema = z
  .object({
    kind: z.literal("runs"),
    runs: z.array(RichTextRunSchema).min(1).max(MOTION_V2_LIMITS.richTextRuns),
  })
  .strict();

export const TextContentSchema = z
  .discriminatedUnion("kind", [TextContentPlainSchema, TextContentRunsSchema])
  .superRefine((content, context) => {
    if (content.kind !== "runs") return;
    const seen = new Set<string>();
    for (let i = 0; i < content.runs.length; i += 1) {
      const run = content.runs[i]!;
      if (seen.has(run.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["runs", i, "id"],
          message: `Duplicate rich-text run id: ${run.id}`,
        });
      }
      seen.add(run.id);
    }
  });

export type TextContent = z.infer<typeof TextContentSchema>;
export type RichTextRun = z.infer<typeof RichTextRunSchema>;

// ── Text payload helpers ──────────────────────────────────────────────

export type TextNodePayload = {
  content: TextContent;
  fontAssetId?: string;
  fontSize: number;
  fontWeight?: number;
  align?: "left" | "center" | "right";
  wrap?: "none" | "word" | "character";
  lineHeight?: number;
  letterSpacing?: number;
  maxLines?: number;
  overflow?: "visible" | "clip" | "ellipsis";
  counterProgress?: number;
  fitText?: { minFontSize: number; maxFontSize: number };
};

export function textContentPlain(content: TextContent): string {
  if (content.kind === "plain") return content.text;
  return content.runs.map((run) => run.text).join("");
}

export function getTextPayloadPlain(payload: {
  content?: TextContent;
  text?: string;
}): string {
  if (payload.content) return textContentPlain(payload.content);
  if (typeof payload.text === "string") return payload.text;
  return "";
}

export function setTextPayloadPlain<
  T extends { content?: TextContent; text?: string },
>(payload: T, text: string): T & { content: TextContent } {
  const next = { ...payload, content: { kind: "plain" as const, text } };
  delete (next as { text?: string }).text;
  return next;
}

export function normalizeTextPayloadInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const payload = { ...(raw as Record<string, unknown>) };
  if (payload.content != null) {
    delete payload.text;
    return payload;
  }
  if (typeof payload.text === "string") {
    const text = payload.text;
    delete payload.text;
    payload.content = { kind: "plain", text };
  }
  return payload;
}

export const TextPayloadSchema = z.preprocess(
  normalizeTextPayloadInput,
  z
    .object({
      content: TextContentSchema,
      fontAssetId: IdSchema.optional(),
      fontSize: FiniteNumberSchema.positive().max(
        MOTION_V2_LIMITS.nodeDimension,
      ),
      fontWeight: FiniteNumberSchema.int().min(1).max(1000).optional(),
      align: z.enum(["left", "center", "right"]).optional(),
      wrap: z.enum(["none", "word", "character"]).optional(),
      lineHeight: FiniteNumberSchema.positive()
        .max(MOTION_V2_LIMITS.nodeDimension)
        .optional(),
      letterSpacing: FiniteNumberSchema.optional(),
      maxLines: FiniteNumberSchema.int().positive().optional(),
      overflow: z.enum(["visible", "clip", "ellipsis"]).optional(),
      counterProgress: FiniteNumberSchema.min(0).max(1).optional(),
      fitText: z
        .object({
          minFontSize: FiniteNumberSchema.positive().max(
            MOTION_V2_LIMITS.nodeDimension,
          ),
          maxFontSize: FiniteNumberSchema.positive().max(
            MOTION_V2_LIMITS.nodeDimension,
          ),
        })
        .strict()
        .optional(),
    })
    .strict(),
);
