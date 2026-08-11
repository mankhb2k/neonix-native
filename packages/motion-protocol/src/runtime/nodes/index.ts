import { z } from "zod";
import { TextNodeSchema } from "./text";
import { PathNodeSchema, ShapeNodeSchema } from "./geometry";
import { ImageNodeSchema, SvgNodeSchema, VideoNodeSchema } from "./media";
import {
  AdjustmentNodeSchema,
  BoneNodeSchema,
  CameraNodeSchema,
  ComponentNodeSchema,
  GroupNodeSchema,
  SolidNodeSchema,
} from "./structural";

export { NodeTimingSchema, type NodeTiming, NodeBaseSchema } from "./base";
export {
  PaintStyleSchema,
  type MotionPaintStyle,
  FitSchema,
  CropSchema,
} from "./paint";
export {
  segmentTextUnits,
  TextNodeSchema,
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
} from "./text";
export {
  PointSchema,
  ShapeNodeSchema,
  PathSegmentSchema,
  PathContourSchema,
  PathMorphTargetSchema,
  PathNodeSchema,
  type MotionPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "./geometry";
export { ImageNodeSchema, SvgNodeSchema, VideoNodeSchema } from "./media";
export {
  GroupNodeSchema,
  BoneNodeSchema,
  CameraNodeSchema,
  ComponentNodeSchema,
  SolidNodeSchema,
  AdjustmentNodeSchema,
  MotionBlurSettingsSchema,
} from "./structural";

export const NodeSchema = z.discriminatedUnion("type", [
  GroupNodeSchema,
  BoneNodeSchema,
  TextNodeSchema,
  ShapeNodeSchema,
  PathNodeSchema,
  ImageNodeSchema,
  SvgNodeSchema,
  VideoNodeSchema,
  CameraNodeSchema,
  ComponentNodeSchema,
  SolidNodeSchema,
  AdjustmentNodeSchema,
]);

export type MotionNode = z.infer<typeof NodeSchema>;
