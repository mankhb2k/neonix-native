/**
 * V3 geometry nodes — shape + path.
 *
 * Owns point/path primitives so V3 is self-contained for path data.
 */

import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { PaintStyleSchema } from "./paint";
import { NodeBaseV3Schema } from "./base";

// ── Shared point / path primitives ────────────────────────────────────

export const PointV2Schema = z
  .object({
    x: FiniteNumberSchema.min(-MOTION_V2_LIMITS.nodeDimension).max(
      MOTION_V2_LIMITS.nodeDimension,
    ),
    y: FiniteNumberSchema.min(-MOTION_V2_LIMITS.nodeDimension).max(
      MOTION_V2_LIMITS.nodeDimension,
    ),
  })
  .strict();

export type MotionPoint = z.infer<typeof PointV2Schema>;

export const PathSegmentV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("line"), to: PointV2Schema }).strict(),
  z
    .object({
      kind: z.literal("cubic"),
      control1: PointV2Schema,
      control2: PointV2Schema,
      to: PointV2Schema,
    })
    .strict(),
]);

export type MotionPathSegment = z.infer<typeof PathSegmentV2Schema>;

export const PathContourV2Schema = z
  .object({
    id: IdSchema,
    start: PointV2Schema,
    segments: z
      .array(PathSegmentV2Schema)
      .min(1)
      .max(MOTION_V2_LIMITS.pathSegmentsPerContour),
    closed: z.boolean(),
  })
  .strict();

export type MotionPathContour = z.infer<typeof PathContourV2Schema>;

export const PathMorphTargetV2Schema = z
  .object({
    id: IdSchema,
    contours: z
      .array(PathContourV2Schema)
      .min(1)
      .max(MOTION_V2_LIMITS.pathContours),
  })
  .strict();

export type MotionPathMorphTarget = z.infer<typeof PathMorphTargetV2Schema>;

// ── V3 geometry nodes ─────────────────────────────────────────────────

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
