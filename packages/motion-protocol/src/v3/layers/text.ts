/**
 * V3 text node — canonical source of truth.
 *
 * Content uses rich text (plain | runs). `color`/`alignment` live on
 * the payload directly instead of v2's style object.
 */
import { z } from "zod";
import { TextPayloadSchema } from "./text-content";
import { LayerBaseV3Schema } from "./base";

export const TextLayerV3Schema = LayerBaseV3Schema.extend({
  type: z.literal("text"),
  payload: TextPayloadSchema,
}).strict();
