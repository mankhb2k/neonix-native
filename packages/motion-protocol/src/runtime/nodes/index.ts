import { z } from "zod";
import { TextNodeV2Schema } from "./text";
import { PathNodeV2Schema, ShapeNodeV2Schema } from "./geometry";
import { ImageNodeV2Schema, SvgNodeV2Schema, VideoNodeV2Schema } from "./media";
import {
  AdjustmentNodeV2Schema,
  BoneNodeV2Schema,
  CameraNodeV2Schema,
  ComponentNodeV2Schema,
  GroupNodeV2Schema,
  SolidNodeV2Schema,
} from "./structural";

export { NodeTimingV2Schema, type NodeTimingV2, NodeBaseSchema } from "./base";
export {
  PaintStyleSchema,
  type MotionPaintStyle,
  FitSchema,
  CropSchema,
} from "./paint";
export {
  segmentTextUnits,
  TextNodeV2Schema,
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
  PointV2Schema,
  ShapeNodeV2Schema,
  PathSegmentV2Schema,
  PathContourV2Schema,
  PathMorphTargetV2Schema,
  PathNodeV2Schema,
  type MotionPoint,
  type MotionPathSegment,
  type MotionPathContour,
  type MotionPathMorphTarget,
} from "./geometry";
export { ImageNodeV2Schema, SvgNodeV2Schema, VideoNodeV2Schema } from "./media";
export {
  GroupNodeV2Schema,
  BoneNodeV2Schema,
  CameraNodeV2Schema,
  ComponentNodeV2Schema,
  SolidNodeV2Schema,
  AdjustmentNodeV2Schema,
  MotionBlurSettingsSchema,
} from "./structural";

export const NodeV2Schema = z.discriminatedUnion("type", [
  GroupNodeV2Schema,
  BoneNodeV2Schema,
  TextNodeV2Schema,
  ShapeNodeV2Schema,
  PathNodeV2Schema,
  ImageNodeV2Schema,
  SvgNodeV2Schema,
  VideoNodeV2Schema,
  CameraNodeV2Schema,
  ComponentNodeV2Schema,
  SolidNodeV2Schema,
  AdjustmentNodeV2Schema,
]);

export type MotionNode = z.infer<typeof NodeV2Schema>;

// ── Phase 7 neutral aliases ─────────────────────────────────────────

export const GroupNodeSchema = GroupNodeV2Schema;
export const BoneNodeSchema = BoneNodeV2Schema;
export const TextNodeSchema = TextNodeV2Schema;
export const ShapeNodeSchema = ShapeNodeV2Schema;
export const PathNodeSchema = PathNodeV2Schema;
export const ImageNodeSchema = ImageNodeV2Schema;
export const SvgNodeSchema = SvgNodeV2Schema;
export const VideoNodeSchema = VideoNodeV2Schema;
export const CameraNodeSchema = CameraNodeV2Schema;
export const SolidNodeSchema = SolidNodeV2Schema;
export const AdjustmentNodeSchema = AdjustmentNodeV2Schema;
export const NodeSchema = NodeV2Schema;
