/**
 * Union layer V1. Discriminator luôn là type (không dùng kind).
 *
 * Chỉ group có children (ít nhất một). component = instance niêm phong. audio = lá root, zIndex âm.
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
  GroupLayerV1Schema as GroupLayerV1BaseSchema,
  SolidLayerV1Schema,
} from "./structural";
import { AudioLayerV1Schema } from "./audio";
import type { AudioLayerV1 } from "./audio";

export { LayerBaseV1Schema, InheritFlagsSchema } from "./base";
export { LayerTimingSchema, type LayerTiming } from "./timing";
export { PaintStyleSchema, type MotionPaintStyle } from "./paint";
export { TextLayerV1Schema } from "./text";
export {
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
export { AudioLayerV1Schema, type AudioLayerV1 } from "./audio";
export { flattenLayerTree, isProjectRootLayer, getRootLayers } from "./flatten";
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

type GroupLayerV1Base = z.infer<typeof GroupLayerV1BaseSchema>;

export type GroupLayerV1 = GroupLayerV1Base & { children: LayerV1[] };

export type LayerV1 =
  | GroupLayerV1
  | z.infer<typeof BoneLayerV1Schema>
  | z.infer<typeof TextLayerV1Schema>
  | z.infer<typeof ShapeLayerV1Schema>
  | z.infer<typeof PathLayerV1Schema>
  | z.infer<typeof ImageLayerV1Schema>
  | z.infer<typeof SvgLayerV1Schema>
  | z.infer<typeof VideoLayerV1Schema>
  | z.infer<typeof CameraLayerV1Schema>
  | z.infer<typeof SolidLayerV1Schema>
  | z.infer<typeof AdjustmentLayerV1Schema>
  | z.infer<typeof ComponentLayerV1Schema>
  | AudioLayerV1;

export const LayerV1Schema: z.ZodType<LayerV1> = z.lazy(() =>
  z.discriminatedUnion("type", [
    GroupLayerV1BaseSchema.extend({
      children: z.array(LayerV1Schema).min(1),
    }),
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
    AudioLayerV1Schema,
  ]),
) as z.ZodType<LayerV1>;
