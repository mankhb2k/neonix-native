/**
 * V3 animation barrel.
 */

// Easing
export {
  KeyframeEasingNamedSchema,
  KeyframeEasingCubicSchema,
  KeyframeEasingSpringSchema,
  KeyframeEasingSchema,
  type KeyframeEasingV3,
} from "./easing";

// Tracks
export {
  ExtrapolationBehaviorSchema,
  SceneMarkerSchema,
  TrackTimeSchema,
  PropertyTrackSchema,
  PropertyTrackV3Schema,
  ExtrapolationBehaviorV3Schema,
  TrackTimeV3Schema,
  SceneMarkerV3Schema,
  TimeSecondsSchema,
  type PropertyTrackV3,
} from "./tracks";

// Clips
export {
  ClipScheduleSchema,
  PlaybackSchema,
  ClipSourceV3Schema,
  ScheduleV3Schema,
  PlaybackV3Schema,
  MotionClipV3Schema,
  type MotionClipV3,
  type ScheduleV3,
  type ClipSourceV3,
} from "./clips";

// Drivers
export {
  ProceduralDriverSchema,
  type ProceduralDriver,
  type ProceduralDriverV2,
} from "./drivers";
