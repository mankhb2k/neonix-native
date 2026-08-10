/**
 * V3 geometry nodes — shape + path.
 *
 * Reuses v2 point/path primitives and paint style so path data is portable
 * between versions.
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import {
  PathContourV2Schema,
  PathMorphTargetV2Schema,
  PathSegmentV2Schema,
  PointV2Schema,
} from "../../v2/nodes/geometry";
import { PaintStyleSchema } from "../../v2/nodes/paint";
import { IdSchema } from "../common";
import { NodeBaseV3Schema } from "./base";

const ShapePayloadSchema = z.discriminatedUnion("shape", [
  z
    .object({
      shape: z.literal("rectangle"),
      cornerRadius: z
        .number()
        .nonnegative()
        .max(MOTION_V2_LIMITS.nodeDimension)
        .optional(),
    })
    .strict(),
  z.object({ shape: z.literal("ellipse") }).strict(),
  z
    .object({
      shape: z.literal("polygon"),
      points: z.array(PointV2Schema).min(3).max(MOTION_V2_LIMITS.polygonPoints),
    })
    .strict(),
]);

export const ShapeNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("shape"),
  payload: ShapePayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();

export const PathNodeV3Schema = NodeBaseV3Schema.extend({
  type: z.literal("path"),
  payload: z
    .object({
      contours: z
        .array(PathContourV2Schema)
        .min(1)
        .max(MOTION_V2_LIMITS.pathContours),
      morphTargets: z
        .array(PathMorphTargetV2Schema)
        .max(MOTION_V2_LIMITS.pathMorphTargets)
        .optional(),
    })
    .strict(),
  style: PaintStyleSchema.optional(),
}).strict();

export type { ShapeNodeV3, PathNodeV3 } from "./geometry-types";
