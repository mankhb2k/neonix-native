import { z } from "zod";
import { V2GroupLayerSchema, type V2GroupLayer } from "./group";
import { V2PathLayerSchema, type V2PathLayer } from "./path";
import { V2ShapeLayerSchema, type V2ShapeLayer } from "./shape";

export { V2LayerBaseSchema, V2FrameSchema, type V2Frame } from "./base";
export { V2GroupLayerSchema, type V2GroupLayer } from "./group";
export { V2ShapeLayerSchema, type V2ShapeLayer } from "./shape";
export { V2PathContourSchema, V2PathLayerSchema, type V2PathLayer } from "./path";

export const V2LayerSchema = z.discriminatedUnion("type", [
  V2GroupLayerSchema,
  V2ShapeLayerSchema,
  V2PathLayerSchema,
]);
export type V2Layer = V2GroupLayer | V2ShapeLayer | V2PathLayer;

export const V2LayerListSchema = z.array(V2LayerSchema);
