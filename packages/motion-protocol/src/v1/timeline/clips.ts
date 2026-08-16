/**
 * Authoring property clip — layer/property animation trên timeline.clips.
 * Compiler lowers these to runtime `propertyAnimations`.
 */
import { z } from "zod";
import { MOTION_PROTOCOL_LIMITS } from "../../capabilities";
import { IdSchema, PropertyPathSchema } from "../common";
import { PropKeyframeSchema } from "../components/prop-values";

export const TimelinePropertyClipV1Schema = z
  .object({
    id: IdSchema,
    layerId: IdSchema,
    property: PropertyPathSchema,
    kind: z.literal("keyframes").default("keyframes"),
    keys: z
      .array(PropKeyframeSchema)
      .min(1)
      .max(MOTION_PROTOCOL_LIMITS.keysPerPropertyAnimation),
  })
  .strict();

export type TimelinePropertyClipV1 = z.infer<typeof TimelinePropertyClipV1Schema>;
