/**
 * Runtime geometry — point/path primitives re-exported from V1;
 * shape and path node schemas use the runtime LayerBaseSchema.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema } from "../common";
import { LayerBaseSchema } from "./base";
import { PaintStyleSchema } from "./paint";

// Shared primitives — imported from V1 for local use, then re-exported
import {
  PointSchema,
  NormalizedPointSchema,
  PathContourSchema,
  PathMorphTargetSchema,
} from "../../v1/layers/geometry";
export {
  PointSchema,
  NormalizedPointSchema,
  PathSegmentSchema,
  PathContourSchema,
  PathMorphTargetSchema,
  type MotionPoint,
  type NormalizedPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "../../v1/layers/geometry";

// Shape node (runtime LayerBaseSchema)
const ShapePayloadSchema = z.discriminatedUnion("shape", [
  z
    .object({
      shape: z.literal("rectangle"),
      cornerRadius: FiniteNumberSchema.nonnegative()
        .max(MOTION_PROTOCOL_LIMITS.layerDimension)
        .optional(),
    })
    .strict(),
  z.object({ shape: z.literal("ellipse") }).strict(),
  z
    .object({
      shape: z.literal("polygon"),
      points: z
        .array(NormalizedPointSchema)
        .min(3)
        .max(MOTION_PROTOCOL_LIMITS.polygonPoints),
    })
    .strict(),
]);

export const ShapeLayerSchema = LayerBaseSchema.extend({
  type: z.literal("shape"),
  payload: ShapePayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();

// Path node (runtime LayerBaseSchema, has fillRule)
export const PathLayerSchema = LayerBaseSchema.extend({
  type: z.literal("path"),
  payload: z
    .object({
      contours: z
        .array(PathContourSchema)
        .min(1)
        .max(MOTION_PROTOCOL_LIMITS.pathContours),
      fillRule: z.enum(["nonzero", "evenodd"]).default("nonzero"),
      morphTargets: z
        .array(PathMorphTargetSchema)
        .max(MOTION_PROTOCOL_LIMITS.pathMorphTargets)
        .optional(),
    })
    .strict(),
  style: PaintStyleSchema.optional(),
}).strict();
