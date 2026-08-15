/**
 * Layer chữ V1. Một hộp, một đoạn, một style trên payload.
 */
import { z } from "zod";
import { TextPayloadSchema } from "./text-content";
import { LayerBaseV1Schema } from "./base";

export const TextLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("text"),
  payload: TextPayloadSchema,
}).strict();
