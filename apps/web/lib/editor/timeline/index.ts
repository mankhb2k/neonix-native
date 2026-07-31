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

// TimelineDocument Aggregate & Validation
export type {
  TimelineDocument,
  TimelineValidationResult,
  TimelineViolation,
  TimelineViolationReason,
} from "@/lib/editor/timeline/document";

export {
  documentFromStoreState,
  storeStateFromDocument,
  validateTimelineDocument,
} from "@/lib/editor/timeline/document";

// Index Builders & Selectors
export type { VisualLayerIndexItem } from "@/lib/editor/timeline/indexes";
export {
  clipsById,
  clipsByLane,
  contentEndSeconds,
  lanesById,
  visualCompositionIndex,
} from "@/lib/editor/timeline/indexes";

// Command Pattern & Application Boundary
export type {
  ClipMovePatch,
  CommandResult,
  PlacementTarget,
  TimelineCommand,
  TimelineDomainEvent,
  TimelineLaneFlags,
} from "@/lib/editor/timeline/commands/command-types";

export { executeTimelineCommand } from "@/lib/editor/timeline/commands/command-runner";

// History Seam & Undo/Redo Engine
export type {
  HistoryEntry,
  HistoryState,
} from "@/lib/editor/timeline/history/history-types";

export {
  canRedo,
  canUndo,
  clearHistory,
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from "@/lib/editor/timeline/history/history-manager";

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
