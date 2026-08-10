/**
 * V3 transform schema — canonical source of truth.
 *
 * Phase 2: copied from legacy/transform.ts → V3 now owns this definition.
 * The canonical name is `TransformSchema` (was `TransformV2Schema`).
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import { FiniteNumberSchema } from "./common";

export const TransformSchema = z
  .object({
    x: FiniteNumberSchema,
    y: FiniteNumberSchema,
    z: FiniteNumberSchema.min(-MOTION_V2_LIMITS.zPositionRange)
      .max(MOTION_V2_LIMITS.zPositionRange)
      .optional(),
    depth: FiniteNumberSchema.optional(),
    width: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
    height: FiniteNumberSchema.nonnegative().max(
      MOTION_V2_LIMITS.nodeDimension,
    ),
    rotation: FiniteNumberSchema,
    rotationX: FiniteNumberSchema.min(-MOTION_V2_LIMITS.rotation3DAngle)
      .max(MOTION_V2_LIMITS.rotation3DAngle)
      .optional(),
    rotationY: FiniteNumberSchema.min(-MOTION_V2_LIMITS.rotation3DAngle)
      .max(MOTION_V2_LIMITS.rotation3DAngle)
      .optional(),
    rotationZ: FiniteNumberSchema.min(-MOTION_V2_LIMITS.rotation3DAngle)
      .max(MOTION_V2_LIMITS.rotation3DAngle)
      .optional(),
    scaleX: FiniteNumberSchema.nonnegative().max(
      MOTION_V2_LIMITS.transformScale,
    ),
    scaleY: FiniteNumberSchema.nonnegative().max(
      MOTION_V2_LIMITS.transformScale,
    ),
    anchorX: FiniteNumberSchema.min(0).max(1),
    anchorY: FiniteNumberSchema.min(0).max(1),
    anchorZ: FiniteNumberSchema.min(0).max(1).optional(),
    opacity: FiniteNumberSchema.min(0).max(1),
    visible: z.boolean(),
    flipX: z.boolean(),
    flipY: z.boolean(),
  })
  .strict();

export type MotionTransform = z.infer<typeof TransformSchema>;

// Backward-compat alias — use `TransformSchema` / `MotionTransform`.
/** @deprecated Use `TransformSchema` instead. */
export const TransformV2Schema = TransformSchema;
