/**
 * V3 scene-local motion clips.
 *
 * Same scheduling vocabulary as v2 (`absolute` | `scene-end` | `after` |
 * `with`) with preset / property-track sources. Component-action sources
 * are dropped: components are timeline-level visual clips in v3.
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import {
  ClipScheduleSchema,
  ClipSourceSchema,
  PlaybackSchema,
} from "../../v2/animation/clips";
import { IdSchema } from "../common";
import { PropertyTrackV3Schema } from "./tracks";

export const ScheduleV3Schema = ClipScheduleSchema;
export const PlaybackV3Schema = PlaybackSchema;

export const ClipSourceV3Schema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("preset"),
      presetId: IdSchema,
      params: z.record(z.unknown()).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("tracks"),
      tracks: z
        .array(PropertyTrackV3Schema)
        .min(1)
        .max(MOTION_V2_LIMITS.tracksPerClip),
    })
    .strict(),
]);

export const MotionClipV3Schema = z
  .object({
    id: IdSchema,
    targetId: IdSchema.optional(),
    schedule: ScheduleV3Schema,
    duration: z.number().positive().finite().max(MOTION_V2_LIMITS.mediaDurationSeconds),
    playback: PlaybackV3Schema.default({}),
    source: ClipSourceV3Schema,
  })
  .strict();

export type MotionClipV3 = z.infer<typeof MotionClipV3Schema>;
export type ScheduleV3 = z.infer<typeof ScheduleV3Schema>;
export type ClipSourceV3 = z.infer<typeof ClipSourceV3Schema>;
