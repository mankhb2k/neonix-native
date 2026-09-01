import { z } from "zod";
import { V2GroupLayerSchema, type V2GroupLayer } from "./group";
import { V2ImageLayerSchema, type V2ImageLayer } from "./image";
import { V2PathLayerSchema, type V2PathLayer } from "./path";
import { V2ShapeLayerSchema, type V2ShapeLayer } from "./shape";
import { V2TextLayerSchema, type V2TextLayer } from "./text";
import { V2VideoLayerSchema, type V2VideoLayer } from "./video";

export {
  V2LayerBaseSchema,
  V2FrameSchema,
  V2BlendModeSchema,
  V2IsolationModeSchema,
  V2CompositeSchema,
  V2MaskModeSchema,
  V2MaskCompositeOperatorSchema,
  V2MaskLayerSchema,
  V2MaskStackSchema,
  type V2Frame,
  type V2BlendMode,
  type V2IsolationMode,
  type V2MaskMode,
  type V2MaskCompositeOperator,
  type V2MaskLayer,
  type V2MaskStack,
} from "./base";
export {
  V2AnimatableValueSchema,
  V2EasingSchema,
  V2InterpolationSchema,
  V2KeyframeSchema,
  V2PropertyPathSchema,
  V2TrackSchema,
  V2TrackListSchema,
  type V2AnimatableValue,
  type V2Easing,
  type V2Interpolation,
  type V2Keyframe,
  type V2PropertyPath,
  type V2Track,
  type V2TrackList,
} from "../animation";
export { V2GroupLayerSchema, type V2GroupLayer } from "./group";
export { V2ImageFitSchema, V2ImageLayerSchema, type V2ImageFit, type V2ImageLayer } from "./image";
export {
  V2ShapeLayerSchema,
  type V2ShapeLayer,
} from "./shape";
export {
  V2TextFontInstanceSchema,
  V2PositionedGlyphSchema,
  V2GlyphRunSchema,
  V2TextLineSchema,
  V2TextLayoutSchema,
  V2TextSourceSchema,
  V2TextLayerSchema,
  type V2TextFontInstance,
  type V2PositionedGlyph,
  type V2GlyphRun,
  type V2TextLine,
  type V2TextLayout,
  type V2TextSource,
  type V2TextLayer,
} from "./text";
export {
  V2PathContourSchema,
  V2PathPointSchema,
  V2PathSegmentSchema,
  V2PathLayerSchema,
  type V2PathLayer,
} from "./path";
export { V2VideoFramePolicySchema, V2VideoLayerSchema, type V2VideoFramePolicy, type V2VideoLayer } from "./video";
export {
  V2BackfaceVisibilitySchema,
  V2PerspectiveContextSchema,
  V2Render3DSchema,
  V2TransformStyleSchema,
  type V2BackfaceVisibility,
  type V2PerspectiveContext,
  type V2Render3D,
  type V2TransformStyle,
} from "../render3d";

export const V2LayerSchema = z.discriminatedUnion("type", [
  V2GroupLayerSchema,
  V2ImageLayerSchema,
  V2ShapeLayerSchema,
  V2TextLayerSchema,
  V2PathLayerSchema,
  V2VideoLayerSchema,
]);
export type V2Layer = V2GroupLayer | V2ImageLayer | V2VideoLayer | V2ShapeLayer | V2PathLayer | V2TextLayer;

export const V2LayerListSchema = z.array(V2LayerSchema);
