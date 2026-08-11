/**
 * Runtime geometry — point/path primitives re-exported from V3;
 * shape and path node schemas use the runtime NodeBaseSchema.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema } from "../common";
import { NodeBaseSchema } from "./base";
import { PaintStyleSchema } from "./paint";

// Shared primitives — imported from V3 for local use, then re-exported
import {
  PointSchema,
  PathSegmentSchema,
  PathContourSchema,
  PathMorphTargetSchema,
} from "../../v3/nodes/geometry";
export {
  PointSchema,
  PathSegmentSchema,
  PathContourSchema,
  PathMorphTargetSchema,
  type MotionPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "../../v3/nodes/geometry";

// Shape node (runtime NodeBaseSchema)
const ShapePayloadSchema = z.discriminatedUnion("shape", [
  z
    .object({
      shape: z.literal("rectangle"),
      cornerRadius: FiniteNumberSchema.nonnegative()
        .max(MOTION_PROTOCOL_LIMITS.nodeDimension)
        .optional(),
    })
    .strict(),
  z.object({ shape: z.literal("ellipse") }).strict(),
  z
    .object({
      shape: z.literal("polygon"),
      points: z.array(PointSchema).min(3).max(MOTION_PROTOCOL_LIMITS.polygonPoints),
    })
    .strict(),
]);

export const ShapeNodeSchema = NodeBaseSchema.extend({
  type: z.literal("shape"),
  payload: ShapePayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();

// Path node (runtime NodeBaseSchema, has fillRule)
export const PathNodeSchema = NodeBaseSchema.extend({
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
