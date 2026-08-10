import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { NodeBaseSchema } from "./base";
import { PaintStyleSchema } from "./paint";

export const PointV2Schema = z.object({
  x: FiniteNumberSchema.min(-MOTION_V2_LIMITS.nodeDimension).max(MOTION_V2_LIMITS.nodeDimension),
  y: FiniteNumberSchema.min(-MOTION_V2_LIMITS.nodeDimension).max(MOTION_V2_LIMITS.nodeDimension),
}).strict();

const ShapePayloadSchema = z.discriminatedUnion("shape", [
  z.object({ shape: z.literal("rectangle"), cornerRadius: FiniteNumberSchema.nonnegative().max(MOTION_V2_LIMITS.nodeDimension).optional() }).strict(),
  z.object({ shape: z.literal("ellipse") }).strict(),
  z.object({
    shape: z.literal("polygon"),
    points: z.array(PointV2Schema).min(3).max(MOTION_V2_LIMITS.polygonPoints),
  }).strict(),
]);

export const ShapeNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("shape"),
  payload: ShapePayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();

export const PathSegmentV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("line"), to: PointV2Schema }).strict(),
  z.object({
    kind: z.literal("cubic"),
    control1: PointV2Schema,
    control2: PointV2Schema,
    to: PointV2Schema,
  }).strict(),
]);

export const PathContourV2Schema = z.object({
  id: IdSchema,
  start: PointV2Schema,
  segments: z.array(PathSegmentV2Schema).min(1).max(MOTION_V2_LIMITS.pathSegmentsPerContour),
  closed: z.boolean(),
}).strict();

export const PathMorphTargetV2Schema = z.object({
  id: IdSchema,
  contours: z.array(PathContourV2Schema).min(1).max(MOTION_V2_LIMITS.pathContours),
}).strict();

export const PathNodeV2Schema = NodeBaseSchema.extend({
  type: z.literal("path"),
  payload: z.object({
    contours: z.array(PathContourV2Schema).min(1).max(MOTION_V2_LIMITS.pathContours),
    fillRule: z.enum(["nonzero", "evenodd"]).default("nonzero"),
    morphTargets: z.array(PathMorphTargetV2Schema).max(MOTION_V2_LIMITS.pathMorphTargets).optional(),
  }).strict(),
  style: PaintStyleSchema.optional(),
}).strict();

export type MotionPoint = z.infer<typeof PointV2Schema>;
export type MotionPathSegment = z.infer<typeof PathSegmentV2Schema>;
export type MotionPathContour = z.infer<typeof PathContourV2Schema>;
export type MotionPathMorphTarget = z.infer<typeof PathMorphTargetV2Schema>;
