import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../capabilities";
import { FiniteNumberSchema } from "./common";

export const TransformSchema = z
  .object({
    x: FiniteNumberSchema,
    y: FiniteNumberSchema,
    /**
     * Perspective-3D Z position (screen depth). Omit or 0 keeps flat output.
     * Range: [-zPositionRange, zPositionRange].
     * @since Phase 11
     */
    z: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.zPositionRange)
      .max(MOTION_PROTOCOL_LIMITS.zPositionRange)
      .optional(),
    /** Layered 2.5D parallax depth; omit or 0 keeps flat-2d output (R4). */
    depth: FiniteNumberSchema.optional(),
    width: FiniteNumberSchema.nonnegative().max(MOTION_PROTOCOL_LIMITS.layerDimension),
    height: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.layerDimension,
    ),
    rotation: FiniteNumberSchema,
    /**
     * Rotation around the X axis in degrees.
     * @since Phase 11
     */
    rotationX: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .max(MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .optional(),
    /**
     * Rotation around the Y axis in degrees.
     * @since Phase 11
     */
    rotationY: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .max(MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .optional(),
    /**
     * Rotation around the Z axis in degrees (alias for `rotation` in 3D mode).
     * @since Phase 11
     */
    rotationZ: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .max(MOTION_PROTOCOL_LIMITS.rotation3DAngle)
      .optional(),
    scaleX: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.transformScale,
    ),
    scaleY: FiniteNumberSchema.nonnegative().max(
      MOTION_PROTOCOL_LIMITS.transformScale,
    ),
    anchorX: FiniteNumberSchema.min(0).max(1),
    anchorY: FiniteNumberSchema.min(0).max(1),
    /**
     * Anchor Z (0=front face, 1=back face).
     * @since Phase 11
     */
    anchorZ: FiniteNumberSchema.min(0).max(1).optional(),
    opacity: FiniteNumberSchema.min(0).max(1),
    visible: z.boolean(),
    flipX: z.boolean(),
    flipY: z.boolean(),
  })
  .strict();

export type MotionTransform = z.infer<typeof TransformSchema>;
