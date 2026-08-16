import { z } from "zod";
import { LayerBaseSchema } from "./base";
import {
  ImagePayloadSchema,
  SvgPayloadSchema,
  VideoPayloadSchema,
} from "../../v1/layers/media";
import { SvgStyleSchema } from "../../v1/layers/paint";

export const ImageLayerSchema = LayerBaseSchema.extend({
  type: z.literal("image"),
  payload: ImagePayloadSchema,
}).strict();

export const SvgLayerSchema = LayerBaseSchema.extend({
  type: z.literal("svg"),
  payload: SvgPayloadSchema,
  style: SvgStyleSchema.optional(),
}).strict();

export const VideoLayerSchema = LayerBaseSchema.extend({
  type: z.literal("video"),
  payload: VideoPayloadSchema,
}).strict();
