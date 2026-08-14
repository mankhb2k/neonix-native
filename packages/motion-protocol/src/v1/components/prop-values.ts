/**
 * Giá trị prop component — tĩnh, gắn variable, hoặc keyframes.
 *
 * Keyframe authoring dùng value (không dùng v của track).
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema } from "../common";
import { KeyframeEasingSchema } from "../animation/easing";
import { JsonValueSchema, VariableReferenceSchema } from "../values";

export const PropKeyframeInterpolationSchema = z.enum([
  "step",
  "linear",
  "color",
]);

export const PropKeyframeSchema = z
  .object({
    t: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    value: JsonValueSchema,
    easing: KeyframeEasingSchema.optional(),
  })
  .strict();

export const PropKeyframesValueSchema = z
  .object({
    kind: z.literal("keyframes"),
    keys: z
      .array(PropKeyframeSchema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.keysPerTrack),
    interpolation: PropKeyframeInterpolationSchema.optional(),
  })
  .strict();

/** Giá trị prop: keyframes | ref variable | literal (thứ tự union quan trọng với Zod). */
export const ComponentPropValueSchema = z.union([
  PropKeyframesValueSchema,
  VariableReferenceSchema,
  JsonValueSchema,
]);

export type PropKeyframe = z.infer<typeof PropKeyframeSchema>;
export type PropKeyframesValue = z.infer<typeof PropKeyframesValueSchema>;
export type ComponentPropValue = z.infer<typeof ComponentPropValueSchema>;

export function isPropKeyframesValue(value: unknown): value is PropKeyframesValue {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).kind === "keyframes" &&
    Array.isArray((value as Record<string, unknown>).keys)
  );
}
