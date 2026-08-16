/**
 * Giá trị prop component — literal hoặc keyframes.
 * Không inline variable ref. Nối variable chỉ qua project.bindings → prop.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema } from "../common";
import { KeyframeEasingSchema } from "../animation/easing";
import { LiteralValueSchema } from "../values";

export const PropKeyframeSchema = z
  .object({
    t: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    ),
    value: LiteralValueSchema,
    easing: KeyframeEasingSchema.optional(),
  })
  .strict();

export const PropKeyframesValueSchema = z
  .object({
    kind: z.literal("keyframes"),
    keys: z
      .array(PropKeyframeSchema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.keysPerPropertyAnimation),
  })
  .strict();

/** Giá trị prop: keyframes hoặc literal. Không `{ ref: { kind: "variable" } }`. */
export const ComponentPropValueSchema = z.union([
  PropKeyframesValueSchema,
  LiteralValueSchema,
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
