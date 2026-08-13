/**
 * V1 animation barrel.
 */

// Easing
export {
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
  KeyframeEasingSchema,
  type KeyframeEasingV1,
} from "./easing";

// Tracks
export {
  ExtrapolationBehaviorSchema,
  TimelineMarkerSchema,
  TrackTimeSchema,
  PropertyTrackSchema,
  PropertyTrackV1Schema,
  ExtrapolationBehaviorV1Schema,
  TrackTimeV1Schema,
  TimelineMarkerV1Schema,
  TimeSecondsSchema,
  type PropertyTrackV1,
} from "./tracks";

// Clips
export {
  ClipScheduleSchema,
  PlaybackSchema,
  ClipSourceV1Schema,
  ScheduleV1Schema,
  PlaybackV1Schema,
  MotionClipV1Schema,
  type MotionClipV1,
  type ScheduleV1,
  type ClipSourceV1,
} from "./clips";

// Drivers
export { ProceduralDriverSchema, type ProceduralDriver } from "./drivers";
