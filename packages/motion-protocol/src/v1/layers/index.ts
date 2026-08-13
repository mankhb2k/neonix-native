/**
 * V1 layer union.
 *
 * `component` layer type represents a sealed component instance as a scene
 * layer (see `component.ts`). Its transform behaves like a group layer;
 * scene-local motion clips target the component layer to animate the whole
 * instance without touching internals.
 */
import { z } from "zod";
import { TextLayerV1Schema } from "./text";
import { PathLayerV1Schema, ShapeLayerV1Schema } from "./geometry";
import {
  CameraLayerV1Schema,
  ImageLayerV1Schema,
  SvgLayerV1Schema,
  VideoLayerV1Schema,
} from "./media";
import { ComponentLayerV1Schema } from "./component";
import {
  AdjustmentLayerV1Schema,
  BoneLayerV1Schema,
  GroupLayerV1Schema,
  SolidLayerV1Schema,
} from "./structural";

export {
  LayerBaseV1Schema,
  LayerMaskV1Schema,
  InheritFlagsSchema,
  TransformV1Schema,
  type TransformV1,
} from "./base";
export { LayerTimingSchema, type LayerTiming } from "./timing";
export { PaintStyleSchema, type MotionPaintStyle } from "./paint";
export { TextLayerV1Schema } from "./text";
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
  ImageLayerV1Schema,
  SvgLayerV1Schema,
  VideoLayerV1Schema,
  CameraLayerV1Schema,
} from "./media";
export {
  GroupLayerV1Schema,
  BoneLayerV1Schema,
  SolidLayerV1Schema,
  AdjustmentLayerV1Schema,
} from "./structural";
export { ComponentLayerV1Schema, type ComponentLayerV1 } from "./component";
export {
  ShapeLayerV1Schema,
  PathLayerV1Schema,
  PointSchema,
  PathSegmentSchema,
  PathContourSchema,
  PathMorphTargetSchema,
  type MotionPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "./geometry";

export const LayerV1Schema = z.discriminatedUnion("type", [
  GroupLayerV1Schema,
  BoneLayerV1Schema,
  TextLayerV1Schema,
  ShapeLayerV1Schema,
  PathLayerV1Schema,
  ImageLayerV1Schema,
  SvgLayerV1Schema,
  VideoLayerV1Schema,
  CameraLayerV1Schema,
  SolidLayerV1Schema,
  AdjustmentLayerV1Schema,
  ComponentLayerV1Schema,
]);

export type LayerV1 = z.infer<typeof LayerV1Schema>;
