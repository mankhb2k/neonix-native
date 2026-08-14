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

export { ProceduralDriverSchema, type ProceduralDriver } from "./drivers";
