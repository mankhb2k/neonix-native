import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  LocaleIdentifierSchema,
} from "../common";
import { NodeBaseSchema } from "./base";
import { PaintStyleSchema } from "./paint";

const TextAnimatorSchema = z
  .object({
    id: IdSchema,
    unit: z.enum(["grapheme", "word", "line"]),
    locale: LocaleIdentifierSchema.optional(),
    selector: z
      .object({
        start: FiniteNumberSchema.min(0).max(1),
        end: FiniteNumberSchema.min(0).max(1),
      })
      .strict(),
    startTime: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    duration: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    stagger: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    easing: z
      .enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"])
      .default("easeOut"),
    properties: z
      .object({
        offsetX: FiniteNumberSchema.optional(),
        offsetY: FiniteNumberSchema.optional(),
        rotation: FiniteNumberSchema.optional(),
        scale: FiniteNumberSchema.nonnegative()
          .max(MOTION_PROTOCOL_LIMITS.transformScale)
          .optional(),
        opacity: FiniteNumberSchema.min(0).max(1).optional(),
        fill: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((animator, context) => {
    if (animator.selector.start > animator.selector.end)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selector", "end"],
        message: "Text Animator selector end must be >= start",
      });
    if (Object.keys(animator.properties).length === 0)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties"],
        message: "Text Animator requires at least one property",
      });
  });

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

const RunHighlightSchema = z
  .object({
    fill: z.string().min(1),
    paddingX: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.richTextHighlightPadding)
      .optional(),
    paddingY: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.richTextHighlightPadding)
      .optional(),
    radius: FiniteNumberSchema.nonnegative()
      .max(MOTION_PROTOCOL_LIMITS.richTextHighlightPadding)
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
      .max(MOTION_PROTOCOL_LIMITS.richTextFontScale)
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
    runs: z
      .array(RichTextRunSchema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.richTextRuns),
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

/** Flatten text content to a plain string (for measurement, animators, search). */
export function textContentPlain(content: TextContent): string {
  if (content.kind === "plain") return content.text;
  return content.runs.map((run) => run.text).join("");
}

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

/** Read plain string from a text node payload (content or legacy text). */
export function getTextPayloadPlain(payload: {
  content?: TextContent;
  text?: string;
}): string {
  if (payload.content) return textContentPlain(payload.content);
  if (typeof payload.text === "string") return payload.text;
  return "";
}

/** Write plain string into content (keeps runs only when already plain). */
export function setTextPayloadPlain<
  T extends { content?: TextContent; text?: string },
>(payload: T, text: string): T & { content: TextContent } {
  const next = { ...payload, content: { kind: "plain" as const, text } };
  delete (next as { text?: string }).text;
  return next;
}

/**
 * Normalize legacy `{ text }` payloads to `{ content: { kind: "plain" } }`.
 * Called at parse boundary before Zod validation.
 */
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

const TextPayloadFieldsSchema = z
  .object({
    content: TextContentSchema,
    fontAssetId: IdSchema.optional(),
    fontSize: FiniteNumberSchema.positive().max(
      MOTION_PROTOCOL_LIMITS.nodeDimension,
    ),
    fontWeight: FiniteNumberSchema.int().min(1).max(1000).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    wrap: z.enum(["none", "word", "character"]).optional(),
    lineHeight: FiniteNumberSchema.positive()
      .max(MOTION_PROTOCOL_LIMITS.nodeDimension)
      .optional(),
    letterSpacing: FiniteNumberSchema.optional(),
    maxLines: FiniteNumberSchema.int().positive().optional(),
    overflow: z.enum(["visible", "clip", "ellipsis"]).optional(),
    counterProgress: FiniteNumberSchema.min(0).max(1).optional(),
    fitText: z
      .object({
        minFontSize: FiniteNumberSchema.positive().max(
          MOTION_PROTOCOL_LIMITS.nodeDimension,
        ),
        maxFontSize: FiniteNumberSchema.positive().max(
          MOTION_PROTOCOL_LIMITS.nodeDimension,
        ),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.fitText && val.fitText.minFontSize >= val.fitText.maxFontSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `fitText.minFontSize (${val.fitText.minFontSize}) must be < maxFontSize (${val.fitText.maxFontSize})`,
        path: ["fitText", "minFontSize"],
      });
    }
  });

export const TextPayloadSchema = z.preprocess(
  normalizeTextPayloadInput,
  TextPayloadFieldsSchema,
);

export const TextNodeSchema = NodeBaseSchema.extend({
  type: z.literal("text"),
  textAnimator: TextAnimatorSchema.optional(),
  payload: TextPayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();
