import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import {
  ColorAdjustPercentSchema,
  FiniteNumberSchema,
  HueRotateSchema,
  IdSchema,
  SemverSchema,
} from "../common";
import { JsonValueSchema } from "../values";
import { LayoutConstraintSchema } from "../layout";
import { LayerBaseSchema } from "./base";

export const GroupLayerSchema = LayerBaseSchema.extend({
  type: z.literal("group"),
  layout: LayoutConstraintSchema.optional(),
  payload: z.object({}).strict().optional(),
}).strict();

export const BoneLayerSchema = LayerBaseSchema.extend({
  type: z.literal("bone"),
  payload: z
    .object({
      length: FiniteNumberSchema.nonnegative().max(
        MOTION_PROTOCOL_LIMITS.layerDimension,
      ),
      restRotation: FiniteNumberSchema.optional(),
      rotationLimits: z
        .object({ min: FiniteNumberSchema, max: FiniteNumberSchema })
        .strict()
        .optional(),
    })
    .strict(),
}).strict();

export const CameraLayerSchema = LayerBaseSchema.omit({
  frame: true,
  layoutItem: true,
}).extend({
  type: z.literal("camera"),
  payload: z
    .object({
      zoom: FiniteNumberSchema.positive().max(
        MOTION_PROTOCOL_LIMITS.transformScale,
      ),
      projection: z.enum(["orthographic", "perspective"]).optional(),
      /** Field of view in degrees (1–179). Required for perspective projection. */
      fov: FiniteNumberSchema.min(1).max(179).optional(),
      /** Near clip plane distance. */
      near: FiniteNumberSchema.positive()
        .max(MOTION_PROTOCOL_LIMITS.cameraFar)
        .optional(),
      /** Far clip plane distance. */
      far: FiniteNumberSchema.positive()
        .max(MOTION_PROTOCOL_LIMITS.cameraFar)
        .optional(),
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
      parallaxStrength: FiniteNumberSchema.min(0)
        .max(MOTION_PROTOCOL_LIMITS.parallaxFactor)
        .optional(),
    })
    .strict()
    .superRefine((val, ctx) => {
      // fov is required for perspective projection
      if (val.projection === "perspective" && val.fov === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fov is required when projection is 'perspective'",
          path: ["fov"],
        });
      }
      // near must be < far
      if (
        val.near !== undefined &&
        val.far !== undefined &&
        val.near >= val.far
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `near (${val.near}) must be < far (${val.far})`,
          path: ["near"],
        });
      }
    }),
}).strict();

export const ComponentLayerSchema = LayerBaseSchema.extend({
  type: z.literal("component"),
  payload: z
    .object({
      componentId: IdSchema,
      componentVersion: SemverSchema,
      props: z.record(JsonValueSchema),
    })
    .strict(),
}).strict();

export const SolidLayerSchema = LayerBaseSchema.extend({
  type: z.literal("solid"),
  payload: z
    .object({
      color: z.string().min(1),
    })
    .strict(),
}).strict();

export const AdjustmentLayerSchema = LayerBaseSchema.extend({
  type: z.literal("adjustment"),
  payload: z
    .object({
      brightness: ColorAdjustPercentSchema.optional(),
      contrast: ColorAdjustPercentSchema.optional(),
      saturation: ColorAdjustPercentSchema.optional(),
      "hue-rotate": HueRotateSchema.optional(),
    })
    .strict(),
}).strict();

// Motion blur — re-exported from V1
export { MotionBlurSettingsSchema } from "../../v1/layers/structural";
