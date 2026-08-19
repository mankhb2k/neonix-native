/**
 * Authoring layer property animation — lives on visual `layer.animations[]`.
 * Compiler lowers these to runtime `propertyAnimations`.
 *
 * Core JSON: `{ property, keys }` only. Session editor may attach transient id/kind
 * before expand strips them.
 *
 * `t` is local to the owning layer: 0 .. layer.timing.duration.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { PropertyPathSchema } from "../common";
import { PropKeyframeSchema } from "../components/prop-values";

export const LayerPropertyAnimationV1Schema = z
  .object({
    property: PropertyPathSchema,
    keys: z
      .array(PropKeyframeSchema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.keysPerPropertyAnimation),
  })
  .strict();

export type LayerPropertyAnimationV1 = z.infer<
  typeof LayerPropertyAnimationV1Schema
>;

export function getLayerAnimations(layer: {
  type: string;
  animations?: LayerPropertyAnimationV1[];
}): LayerPropertyAnimationV1[] {
  if (layer.type === "audio") return [];
  return layer.animations ?? [];
}
