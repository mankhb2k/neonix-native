/**
 * V3 geometry nodes — shape + path.
 *
 * Owns point/path primitives so V3 is self-contained for path data.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { PaintStyleSchema } from "./paint";
import { NodeBaseV3Schema } from "./base";

// ── Shared point / path primitives ────────────────────────────────────

export const PointSchema = z
  .object({
    x: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.nodeDimension).max(
      MOTION_PROTOCOL_LIMITS.nodeDimension,
    ),
    y: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.nodeDimension).max(
      MOTION_PROTOCOL_LIMITS.nodeDimension,
    ),
  })
  .strict();

export type MotionPoint = z.infer<typeof PointSchema>;

export const PathSegmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("line"), to: PointSchema }).strict(),
  z
    .object({
      kind: z.literal("cubic"),
      control1: PointSchema,
      control2: PointSchema,
      to: PointSchema,
    })
    .strict(),
]);

export type MotionPathSegment = z.infer<typeof PathSegmentSchema>;

export const PathContourSchema = z
  .object({
    id: IdSchema,
    start: PointSchema,
    segments: z
      .array(PathSegmentSchema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.pathSegmentsPerContour),
    closed: z.boolean(),
  })
  .strict();

export type MotionPathContour = z.infer<typeof PathContourSchema>;

export const PathMorphTargetSchema = z
  .object({
    id: IdSchema,
    contours: z
      .array(PathContourSchema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.pathContours),
  })
  .strict();

export type MotionPathMorphTarget = z.infer<typeof PathMorphTargetSchema>;

// ── V3 geometry nodes ─────────────────────────────────────────────────

const ShapePayloadSchema = z.discriminatedUnion("shape", [
  z
    .object({
      shape: z.literal("rectangle"),
      cornerRadius: z
        .number()
        .nonnegative()
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
        .array(PathContourSchema)
        .min(1)
        .max(MOTION_PROTOCOL_LIMITS.pathContours),
      morphTargets: z
        .array(PathMorphTargetSchema)
        .max(MOTION_PROTOCOL_LIMITS.pathMorphTargets)
        .optional(),
    })
    .strict(),
  style: PaintStyleSchema.optional(),
}).strict();

export type { ShapeNodeV3, PathNodeV3 } from "./geometry-types";

// ── Phase 7 neutral aliases (geometry primitives) ───────────────────

