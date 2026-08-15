import { z } from "zod";
import { TextLayerSchema } from "./text";
import { PathLayerSchema, ShapeLayerSchema } from "./geometry";
import { ImageLayerSchema, SvgLayerSchema, VideoLayerSchema } from "./media";
import {
  AdjustmentLayerSchema,
  BoneLayerSchema,
  CameraLayerSchema,
  ComponentLayerSchema,
  GroupLayerSchema,
  SolidLayerSchema,
} from "./structural";

export { RuntimeAudioLayerSchema, type RuntimeAudioLayer } from "./audio";
export { LayerTimingSchema, type LayerTiming, LayerBaseSchema } from "./base";
export {
  PaintStyleSchema,
  type MotionPaintStyle,
  FitSchema,
  CropSchema,
} from "./paint";
export {
  segmentTextUnits,
  TextLayerSchema,
  TextPayloadSchema,
  getTextPayloadPlain,
  setTextPayloadPlain,
  normalizeTextPayloadInput,
  type TextLayerPayload,
} from "./text";
export {
  PointSchema,
  NormalizedPointSchema,
  ShapeLayerSchema,
  PathSegmentSchema,
  PathContourSchema,
  PathMorphTargetSchema,
  PathLayerSchema,
  type MotionPoint,
  type NormalizedPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "./geometry";
export { ImageLayerSchema, SvgLayerSchema, VideoLayerSchema } from "./media";
export {
  GroupLayerSchema,
  BoneLayerSchema,
  CameraLayerSchema,
  ComponentLayerSchema,
  SolidLayerSchema,
  AdjustmentLayerSchema,
  MotionBlurSettingsSchema,
} from "./structural";

export const LayerSchema = z.discriminatedUnion("type", [
  GroupLayerSchema,
  BoneLayerSchema,
  TextLayerSchema,
  ShapeLayerSchema,
  PathLayerSchema,
  ImageLayerSchema,
  SvgLayerSchema,
  VideoLayerSchema,
  CameraLayerSchema,
  ComponentLayerSchema,
  SolidLayerSchema,
  AdjustmentLayerSchema,
]);

export type MotionLayer = z.infer<typeof LayerSchema>;
