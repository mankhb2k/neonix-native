/**
 * V3 node union.
 *
 * Note: `component` node type is intentionally REMOVED from v3 — component
 * instances become visual-clip sources on the timeline (see `timeline.ts`).
 */
import { z } from "zod";
import { TextNodeV3Schema } from "./text";
import { PathNodeV3Schema, ShapeNodeV3Schema } from "./geometry";
import {
  CameraNodeV3Schema,
  ImageNodeV3Schema,
  SvgNodeV3Schema,
  VideoNodeV3Schema,
} from "./media";
import {
  AdjustmentNodeV3Schema,
  BoneNodeV3Schema,
  GroupNodeV3Schema,
  SolidNodeV3Schema,
} from "./structural";

export {
  NodeBaseV3Schema,
  NodeMaskV3Schema,
  InheritFlagsSchema,
  TransformV3Schema,
  type TransformV3,
} from "./base";
export { NodeTimingSchema, type NodeTiming, type NodeTimingV2 } from "./timing";
export { PaintStyleSchema, type MotionPaintStyle } from "./paint";
export { TextNodeV3Schema } from "./text";
export {
  // Shared text content schemas and helpers
  segmentTextUnits,
  TextContentSchema,
  RichTextRunSchema,
  TextPayloadSchema,
  textContentPlain,
  getTextPayloadPlain,
  setTextPayloadPlain,
  normalizeTextPayloadInput,
  type TextContent,
  type RichTextRun,
  type TextNodePayload,
} from "./text-content";
export {
  ImageNodeV3Schema,
  SvgNodeV3Schema,
  VideoNodeV3Schema,
  CameraNodeV3Schema,
} from "./media";
export {
  GroupNodeV3Schema,
  BoneNodeV3Schema,
  SolidNodeV3Schema,
  AdjustmentNodeV3Schema,
} from "./structural";
export {
  ShapeNodeV3Schema,
  PathNodeV3Schema,
  PointSchema,
  PathSegmentSchema,
  PathContourSchema,
  PathMorphTargetSchema,
  type MotionPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "./geometry";

export const NodeV3Schema = z.discriminatedUnion("type", [
  GroupNodeV3Schema,
  BoneNodeV3Schema,
  TextNodeV3Schema,
  ShapeNodeV3Schema,
  PathNodeV3Schema,
  ImageNodeV3Schema,
  SvgNodeV3Schema,
  VideoNodeV3Schema,
  CameraNodeV3Schema,
  SolidNodeV3Schema,
  AdjustmentNodeV3Schema,
]);

export type NodeV3 = z.infer<typeof NodeV3Schema>;
