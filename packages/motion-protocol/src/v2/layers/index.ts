import { z } from "zod";
import { V2ShapeLayerSchema, type V2ShapeLayer } from "./shape";

export { V2LayerBaseSchema, V2FrameSchema, type V2Frame } from "./base";
export { V2ShapeLayerSchema, type V2ShapeLayer } from "./shape";

export const V2LayerSchema = V2ShapeLayerSchema;
export type V2Layer = V2ShapeLayer;

export const V2LayerListSchema = z.array(V2LayerSchema);
