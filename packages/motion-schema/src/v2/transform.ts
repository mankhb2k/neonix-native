import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { FiniteNumberSchema } from "./common";

export const TransformV2Schema = z
  .object({
    x: FiniteNumberSchema,
    y: FiniteNumberSchema,
    /** Layered 2.5D parallax depth; omit or 0 keeps flat-2d output (R4). */
    depth: FiniteNumberSchema.optional(),
    width: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
    height: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
    rotation: FiniteNumberSchema,
    scaleX: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.transformScale),
    scaleY: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.transformScale),
    anchorX: FiniteNumberSchema.min(0).max(1),
    anchorY: FiniteNumberSchema.min(0).max(1),
    opacity: FiniteNumberSchema.min(0).max(1),
    visible: z.boolean(),
    flipX: z.boolean(),
    flipY: z.boolean(),
  })
  .strict();

export type MotionTransform = z.infer<typeof TransformV2Schema>;
