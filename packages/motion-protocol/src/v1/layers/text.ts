/**
 * V1 text node — canonical source of truth.
 *
 * Content uses rich text (plain | runs). `color`/`alignment` live on
 * the payload directly instead of v2's style object.
 */
import { z } from "zod";
import { TextPayloadSchema } from "./text-content";
import { LayerBaseV1Schema } from "./base";

export const TextLayerV1Schema = LayerBaseV1Schema.extend({
  type: z.literal("text"),
  payload: TextPayloadSchema,
}).strict();
