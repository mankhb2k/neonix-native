/**
 * Legacy geometry — point/path primitives re-exported from V3;
 * V2-specific ShapeNodeV2Schema and PathNodeV2Schema kept here.
 *
 * @deprecated Import from `@motionvideo/motion-protocol/v3` for primitives.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema } from "../common";
import { NodeBaseSchema } from "./base";
import { PaintStyleSchema } from "./paint";

// Shared primitives — imported from V3 for local use, then re-exported
import {
  PointV2Schema,
  PathSegmentV2Schema,
  PathContourV2Schema,
  PathMorphTargetV2Schema,
} from "../../v3/nodes/geometry";
export {
  PointV2Schema,
  PathSegmentV2Schema,
  PathContourV2Schema,
  PathMorphTargetV2Schema,
  type MotionPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "../../v3/nodes/geometry";

// V2-specific shape node (uses legacy NodeBaseSchema)
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
      points: z.array(PointV2Schema).min(3).max(MOTION_PROTOCOL_LIMITS.polygonPoints),
    })
    .strict(),
]);

export const ShapeNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("shape"),
  payload: ShapePayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();

// V2-specific path node (uses legacy NodeBaseSchema, has fillRule)
export const PathNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("path"),
  payload: z
    .object({
      contours: z
        .array(PathContourV2Schema)
        .min(1)
        .max(MOTION_PROTOCOL_LIMITS.pathContours),
      fillRule: z.enum(["nonzero", "evenodd"]).default("nonzero"),
      morphTargets: z
        .array(PathMorphTargetV2Schema)
        .max(MOTION_PROTOCOL_LIMITS.pathMorphTargets)
        .optional(),
    })
    .strict(),
  style: PaintStyleSchema.optional(),
}).strict();
