/**
 * Layer hình học V1 — shape + path. Sở hữu primitive điểm/path.
 */

import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { FiniteNumberSchema, IdSchema } from "../common";
import { PaintStyleSchema } from "./paint";
import { LayerBaseV1Schema } from "./base";

// ── Shared point / path primitives ────────────────────────────────────

export const PointSchema = z
  .object({
    x: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.layerDimension).max(
      MOTION_PROTOCOL_LIMITS.layerDimension,
    ),
    y: FiniteNumberSchema.min(-MOTION_PROTOCOL_LIMITS.layerDimension).max(
      MOTION_PROTOCOL_LIMITS.layerDimension,
    ),
  })
  .strict();

export type MotionPoint = z.infer<typeof PointSchema>;

/** Polygon vertices — 0..1 trong frame (0,0 góc trên trái; 1,1 góc dưới phải). */
export const NormalizedPointSchema = z
  .object({
    x: FiniteNumberSchema.min(0).max(1),
    y: FiniteNumberSchema.min(0).max(1),
  })
  .strict();

export type NormalizedPoint = z.infer<typeof NormalizedPointSchema>;

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

// ── V1 geometry layers ─────────────────────────────────────────────────

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

export const ShapeLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("shape"),
  payload: ShapePayloadSchema,
  style: PaintStyleSchema.optional(),
}).strict();

export const PathLayerV1Schema = LayerBaseV1Schema.extend({
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

export type { ShapeLayerV1, PathLayerV1 } from "./geometry-types";

// ── Phase 7 neutral aliases (geometry primitives) ───────────────────

