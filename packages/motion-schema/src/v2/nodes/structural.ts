import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema, SemverSchema } from "../common";
import { JsonValueSchema } from "../values";
import { NodeBaseSchema } from "./base";

export const GroupNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("group"),
  payload: z.object({
    compositing: z.object({
      mode: z.enum(["pass-through", "isolate"]).default("pass-through")
    }).strict().optional(),
  }).strict().optional(),
}).strict();

export const BoneNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("bone"),
  payload: z.object({
    length: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension),
    restRotation: FiniteNumberSchema.optional(),
    rotationLimits: z.object({ min: FiniteNumberSchema, max: FiniteNumberSchema }).strict().optional(),
  }).strict(),
}).strict();

export const CameraNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("camera"),
  payload: z.object({
    zoom: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.transformScale),
    projection: z.enum(["orthographic", "perspective"]).optional(),
    /** Field of view in degrees (1–179). Required for perspective projection. */
    fov: FiniteNumberSchema.min(1).max(179).optional(),
    /** Near clip plane distance. */
    near: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.cameraFar).optional(),
    /** Far clip plane distance. */
    far: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.cameraFar).optional(),
    /**
     * X rotation of the camera in degrees (pitch).
     * @since Phase 11
     */
    rotationX: FiniteNumberSchema.min(-180).max(180).optional(),
    /**
     * Y rotation of the camera in degrees (yaw).
     * @since Phase 11
     */
    rotationY: FiniteNumberSchema.min(-180).max(180).optional(),
    parallaxStrength: FiniteNumberSchema.min(0).max(MOTION_V2_LIMITS.parallaxFactor).optional(),
  }).strict(),
}).strict();

export const ComponentNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("component"),
  payload: z
    .object({
      componentId: IdSchema,
      componentVersion: SemverSchema,
      props: z.record(JsonValueSchema),
    })
    .strict(),
}).strict();

export const SolidNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("solid"),
  payload: z.object({
    width: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
    height: FiniteNumberSchema.positive().max(MOTION_V2_LIMITS.nodeDimension),
    color: z.string().min(1),
  }).strict(),
}).strict();

export const AdjustmentNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("adjustment"),
  payload: z
    .object({
      brightness: FiniteNumberSchema.min(-1).max(1).optional(),
      contrast: FiniteNumberSchema.min(0).max(4).optional(),
      saturation: FiniteNumberSchema.min(0).max(4).optional(),
    })
    .strict(),
}).strict();

export const MotionBlurSettingsSchema = z
  .object({
    enabled: z.boolean(),
    shutterAngle: FiniteNumberSchema.positive().max(360).optional(),
    sampleCount: FiniteNumberSchema.int().positive().max(32).optional(),
  })
  .strict();
