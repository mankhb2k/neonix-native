/**
 * Authoring property clip — layer/property animation trên timeline.clips.
 * Khác MotionClipV1 (internal compiler) ở src/v1/animation/clips.ts.
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
      .max(MOTION_PROTOCOL_LIMITS.keysPerTrack),
  })
  .strict();

export type TimelinePropertyClipV1 = z.infer<typeof TimelinePropertyClipV1Schema>;
