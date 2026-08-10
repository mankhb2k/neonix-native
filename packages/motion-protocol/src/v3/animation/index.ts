/**
 * V3 animation barrel.
 */
export {
  PropertyTrackV3Schema,
  ExtrapolationBehaviorV3Schema,
  TrackTimeV3Schema,
  SceneMarkerV3Schema,
  TimeSecondsSchema,
  type PropertyTrackV3,
} from "./tracks";
export {
  ScheduleV3Schema,
  PlaybackV3Schema,
  ClipSourceV3Schema,
  MotionClipV3Schema,
  type MotionClipV3,
  type ScheduleV3,
  type ClipSourceV3,
} from "./clips";
export { KeyframeEasingV2Schema, type KeyframeEasingV3 } from "./easing";
export { ProceduralDriverSchema } from "./drivers";
