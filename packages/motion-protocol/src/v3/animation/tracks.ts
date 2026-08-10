/**
 * V3 property tracks — same shape as v2 (target, property, keys, easing,
 * pre/post extrapolation).
 */
import { z } from "zod";
import { MOTION_V2_LIMITS } from "../../capabilities";
import {
  ExtrapolationBehaviorSchema,
  PropertyTrackSchema,
  SceneMarkerSchema,
  TrackTimeSchema,
} from "../../v2/animation/tracks";
import { FiniteNumberSchema, IdSchema } from "../common";

export const PropertyTrackV3Schema = PropertyTrackSchema;
export const ExtrapolationBehaviorV3Schema = ExtrapolationBehaviorSchema;
export const TrackTimeV3Schema = TrackTimeSchema;

export const SceneMarkerV3Schema = SceneMarkerSchema;

/** Clip-local time in seconds (must be non-negative). */
export const TimeSecondsSchema = FiniteNumberSchema.nonnegative().max(
  MOTION_V2_LIMITS.mediaDurationSeconds,
);

export type PropertyTrackV3 = z.infer<typeof PropertyTrackV3Schema>;
