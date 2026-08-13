/**
 * V3 node union.
 *
 * `component` node type represents a sealed component instance as a scene
 * layer/object (see `component.ts`). Its transform behaves like a group layer;
 * scene-local motion clips target the component node to animate the whole
 * instance without touching internals.
 */
import { z } from "zod";
import { TextLayerV3Schema } from "./text";
import { PathLayerV3Schema, ShapeLayerV3Schema } from "./geometry";
import {
  CameraLayerV3Schema,
  ImageLayerV3Schema,
  SvgLayerV3Schema,
  VideoLayerV3Schema,
} from "./media";
import { ComponentLayerV3Schema } from "./component";
import {
  AdjustmentLayerV3Schema,
  BoneLayerV3Schema,
  GroupLayerV3Schema,
  SolidLayerV3Schema,
} from "./structural";

export {
  LayerBaseV3Schema,
  LayerMaskV3Schema,
  InheritFlagsSchema,
  TransformV3Schema,
  type TransformV3,
} from "./base";
export { LayerTimingSchema, type LayerTiming } from "./timing";
export { PaintStyleSchema, type MotionPaintStyle } from "./paint";
export { TextLayerV3Schema } from "./text";
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
  type TextLayerPayload,
} from "./text-content";
export {
  ImageLayerV3Schema,
  SvgLayerV3Schema,
  VideoLayerV3Schema,
  CameraLayerV3Schema,
} from "./media";
export {
  GroupLayerV3Schema,
  BoneLayerV3Schema,
  SolidLayerV3Schema,
  AdjustmentLayerV3Schema,
} from "./structural";
export { ComponentLayerV3Schema, type ComponentLayerV3 } from "./component";
export {
  ShapeLayerV3Schema,
  PathLayerV3Schema,
  PointSchema,
  PathSegmentSchema,
  PathContourSchema,
  PathMorphTargetSchema,
  type MotionPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "./geometry";

export const LayerV3Schema = z.discriminatedUnion("type", [
  GroupLayerV3Schema,
  BoneLayerV3Schema,
  TextLayerV3Schema,
  ShapeLayerV3Schema,
  PathLayerV3Schema,
  ImageLayerV3Schema,
  SvgLayerV3Schema,
  VideoLayerV3Schema,
  CameraLayerV3Schema,
  SolidLayerV3Schema,
  AdjustmentLayerV3Schema,
  ComponentLayerV3Schema,
]);

export type LayerV3 = z.infer<typeof LayerV3Schema>;
