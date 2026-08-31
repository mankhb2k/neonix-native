import { z } from "zod";
import {
  V2ColorSchema,
  V2FiniteNumberSchema,
  V2IdSchema,
  V2NonNegativeNumberSchema,
  V2PositiveNumberSchema,
} from "../common";
import { V2Vec2Schema } from "../transform";
import { V2LayerBaseSchema } from "./base";
import { V2EffectListSchema } from "../effects";

const V2NfcTextSchema = z.string().refine(
  (value) => value === value.normalize("NFC"),
  "Text source must be NFC normalized",
);

/** OpenType variation axis tags are exactly four printable ASCII characters. */
const V2FontVariationAxisTagSchema = z
  .string()
  .regex(/^[ -~]{4}$/, "Font variation axis tag must contain exactly four printable ASCII characters");

/** A run ID occupies one track-path segment and therefore cannot contain a dot. */
const V2TextRunIdSchema = V2IdSchema.refine(
  (value) => !value.includes("."),
  "Glyph run id cannot contain a dot",
);

/**
 * A concrete font instance selected by the text shaper. Font fallback is
 * represented by separate glyph runs that select their own font assets.
 */
export const V2TextFontInstanceSchema = z
  .object({
    assetId: V2IdSchema,
    size: V2PositiveNumberSchema,
    /** Resolved OpenType variation coordinates, for example { wght: 650 }. */
    variations: z.record(V2FontVariationAxisTagSchema, V2FiniteNumberSchema).optional(),
  })
  .strict();

/** One glyph already shaped and positioned in the text layer's local units. */
export const V2PositionedGlyphSchema = z
  .object({
    glyphId: V2NonNegativeNumberSchema.int(),
    x: V2FiniteNumberSchema,
    y: V2FiniteNumberSchema,
    /** Advance vector retained for editor selection/caret use and vertical text. */
    advance: V2Vec2Schema,
    /** Optional UTF-16 offset into payload.source.text for editor mapping only. */
    cluster: V2NonNegativeNumberSchema.int().optional(),
  })
  .strict();

/**
 * One visually ordered sequence with one font instance and one paint. Its
 * identifier is a stable target for run-level color/font animation tracks.
 */
export const V2GlyphRunSchema = z
  .object({
    id: V2TextRunIdSchema,
    font: V2TextFontInstanceSchema,
    fill: V2ColorSchema,
    glyphs: z.array(V2PositionedGlyphSchema).min(1),
  })
  .strict();

/** One baseline and its glyph runs, in visual paint order. */
export const V2TextLineSchema = z
  .object({
    id: V2IdSchema,
    baselineY: V2FiniteNumberSchema,
    runIds: z.array(V2IdSchema).min(1),
  })
  .strict()
  .superRefine((line, ctx) => {
    const seen = new Set<string>();
    for (const [index, runId] of line.runIds.entries()) {
      if (seen.has(runId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Text line cannot reference glyph run more than once: ${runId}`,
          path: ["runIds", index],
        });
      }
      seen.add(runId);
    }
  });

/**
 * Canonical render input for text. The compiler/text shaper resolves CSS
 * wrapping, bidi, fallback, features, spacing, and inline style into this
 * layout before Protocol V2 is emitted. The runtime renders glyph IDs using
 * the selected font asset; it does not rerun CSS text layout.
 */
export const V2TextLayoutSchema = z
  .object({
    lines: z.array(V2TextLineSchema).min(1),
    runs: z.array(V2GlyphRunSchema).min(1),
  })
  .strict()
  .superRefine((layout, ctx) => {
    const runIds = new Set<string>();
    for (const [index, run] of layout.runs.entries()) {
      if (runIds.has(run.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate glyph run id: ${run.id}`,
          path: ["runs", index, "id"],
        });
      }
      runIds.add(run.id);
    }

    const lineIds = new Set<string>();
    const referencedRunIds = new Set<string>();
    for (const [lineIndex, line] of layout.lines.entries()) {
      if (lineIds.has(line.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate text line id: ${line.id}`,
          path: ["lines", lineIndex, "id"],
        });
      }
      lineIds.add(line.id);
      for (const [runIndex, runId] of line.runIds.entries()) {
        if (!runIds.has(runId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown glyph run referenced by line: ${runId}`,
            path: ["lines", lineIndex, "runIds", runIndex],
          });
        }
        if (referencedRunIds.has(runId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Glyph run must belong to exactly one text line: ${runId}`,
            path: ["lines", lineIndex, "runIds", runIndex],
          });
        }
        referencedRunIds.add(runId);
      }
    }

    for (const [index, run] of layout.runs.entries()) {
      if (!referencedRunIds.has(run.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Glyph run is not referenced by a text line: ${run.id}`,
          path: ["runs", index, "id"],
        });
      }
    }
  });

/** Optional authoring/editor metadata. It is never the render authority. */
export const V2TextSourceSchema = z
  .object({
    text: V2NfcTextSchema,
    language: z.string().trim().min(1).max(35).optional(),
  })
  .strict();

export const V2TextLayerSchema = V2LayerBaseSchema.extend({
  type: z.literal("text"),
  effects: V2EffectListSchema.optional(),
  payload: z
    .object({
      /** Optional source/editor data; runtime rendering reads layout only. */
      source: V2TextSourceSchema.optional(),
      layout: V2TextLayoutSchema,
    })
    .strict(),
}).strict();

export type V2TextFontInstance = z.infer<typeof V2TextFontInstanceSchema>;
export type V2PositionedGlyph = z.infer<typeof V2PositionedGlyphSchema>;
export type V2GlyphRun = z.infer<typeof V2GlyphRunSchema>;
export type V2TextLine = z.infer<typeof V2TextLineSchema>;
export type V2TextLayout = z.infer<typeof V2TextLayoutSchema>;
export type V2TextSource = z.infer<typeof V2TextSourceSchema>;
export type V2TextLayer = z.infer<typeof V2TextLayerSchema>;
