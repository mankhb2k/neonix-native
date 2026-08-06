import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, LocaleIdentifierSchema } from "../common";
import { NodeBaseSchema } from "./base";
import { PaintStyleSchema } from "./paint";

const TextAnimatorSchema = z.object({
  id: IdSchema,
  unit: z.enum(["grapheme", "word", "line"]),
  locale: LocaleIdentifierSchema.optional(),
  selector: z.object({ start: FiniteNumberSchema.min(0).max(1), end: FiniteNumberSchema.min(0).max(1) }).strict(),
  startTime: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  duration: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  stagger: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.mediaDurationSeconds),
  easing: z.enum(["linear", "step", "easeIn", "easeOut", "easeInOut", "spring"]).default("easeOut"),
  properties: z.object({
    offsetX: FiniteNumberSchema.optional(),
    offsetY: FiniteNumberSchema.optional(),
    rotation: FiniteNumberSchema.optional(),
    scale: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.transformScale).optional(),
    opacity: FiniteNumberSchema.min(0).max(1).optional(),
    fill: z.string().min(1).optional(),
  }).strict(),
}).strict().superRefine((animator, context) => {
  if (animator.selector.start > animator.selector.end) context.addIssue({ code: z.ZodIssueCode.custom, path: ["selector", "end"], message: "Text Animator selector end must be >= start" });
  if (Object.keys(animator.properties).length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["properties"], message: "Text Animator requires at least one property" });
});

export function segmentTextUnits(text: string, unit: "grapheme" | "word" | "line", locale = "vi"): string[] {
  if (unit === "line") return text.split(/\r?\n/);
  const segments = [...new Intl.Segmenter(locale, { granularity: unit }).segment(text)];
  return unit === "word"
    ? segments.map((segment) => segment.segment).filter((segment) => segment.trim().length > 0)
    : segments.map((segment) => segment.segment);
}

export const TextNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("text"),
  textAnimator: TextAnimatorSchema.optional(),
  payload: z.object({
    text: z.string(),
    fontAssetId: IdSchema.optional(),
    fontSize: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
    fontWeight: FiniteNumberSchema.int().min(1).max(1000).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    wrap: z.enum(["none", "word", "character"]).optional(),
    lineHeight: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension).optional(),
    letterSpacing: FiniteNumberSchema.optional(),
    maxLines: FiniteNumberSchema.int().positive().optional(),
    counterProgress: FiniteNumberSchema.min(0).max(1).optional(),
    fitText: z
      .object({
        minFontSize: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
        maxFontSize: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
      })
      .strict()
      .optional(),
  }).strict(),
  style: PaintStyleSchema.optional(),
}).strict();
