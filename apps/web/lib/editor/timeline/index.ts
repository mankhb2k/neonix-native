/**
 * Public Timeline Domain Namespace.
 * High-level exports for UI components, application layer, and external consumers.
 * Internal store helpers (store/internal/*) MUST NOT be exported here.
 */

// Model Types & Discriminated Unions
export type {
  AudioTrackRole,
  AudioTimelineClip,
  AudioTimelineLane,
  SceneTimelineClip,
  TimelineClip,
  TimelineLane,
  TimelineLaneRole,
  TimelineTrackKind,
  TrackFamily,
  VisualTrackRole,
  VisualLanePolicy,
  VisualTimelineLane,
} from "@/lib/editor/model/timeline-types";

export {
  DEFAULT_VISUAL_POLICY,
  isAudioClip,
  isBaseLaneObj,
  isOverlayLaneObj,
  isSceneClip,
  isVisualLane,
} from "@/lib/editor/model/timeline-types";

// Canonical Domain Helpers & Predicates
export {
  clipsContentEndSeconds,
  createAudioLane,
  createOverlayLane,
  ensureBaseLane,
  isAudioLane,
  isBaseLane,
  isLaneLocked,
  isOverlayLane,
  laneRippleMode,
  normalizeLaneOrders,
  pruneEmptyLanes,
  rangesOverlap,
  removeLaneExplicitly,
  resolveLaneStartTimeNearest,
  resolveMainStartTime,
} from "@/lib/editor/timeline-clips";

// Zoom & Fit Policies
export {
  fitPixelsPerSecond,
  resolveFitAnchorSeconds,
  sliderValueToZoomScale,
  TIMELINE_EMPTY_SPAN_SECONDS,
  TIMELINE_FIT_ZOOM_SCALE,
  TIMELINE_INITIAL_CLIP_RATIO,
  TIMELINE_INITIAL_SPAN_FACTOR,
  TIMELINE_MIN_FIT_SPAN_SECONDS,
  timelineExtentSeconds,
  timelineFitSpanSeconds,
  ZOOM_OCTAVES,
  zoomScaleToSliderValue,
} from "@/lib/editor/timeline/policies/zoom-fit-policy";
