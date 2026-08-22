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
  V2CompositeSchema,
  V2MaskModeSchema,
  V2MaskSchema,
  type V2Frame,
  type V2BlendMode,
  type V2MaskMode,
  type V2Mask,
} from "./base";
export { V2GroupLayerSchema, type V2GroupLayer } from "./group";
export { V2ImageFitSchema, V2ImageLayerSchema, type V2ImageFit, type V2ImageLayer } from "./image";
export { V2ShapeLayerSchema, type V2ShapeLayer } from "./shape";
export { V2TextLayerSchema, type V2TextLayer } from "./text";
export { V2PathContourSchema, V2PathLayerSchema, type V2PathLayer } from "./path";
export { V2VideoFramePolicySchema, V2VideoLayerSchema, type V2VideoFramePolicy, type V2VideoLayer } from "./video";

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
