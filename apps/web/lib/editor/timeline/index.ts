/**
 * Public Timeline Domain Namespace.
 * High-level exports for UI components, application layer, and external consumers.
 * Internal store helpers (store/internal/*) MUST NOT be exported here.
 */

// Pure domain — @motionvideo/editor-core (web paths re-export for compat)
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
  TimelineDocument,
  TimelineTransition,
  TimelineValidationResult,
  TimelineViolation,
  TimelineViolationReason,
  VisualLayerIndexItem,
  ClipCapability,
  ClipMovePatch,
  CommandResult,
  PlacementTarget,
  TimelineCommand,
  TimelineDomainEvent,
  TimelineLaneFlags,
  HistoryEntry,
  HistoryState,
  LaneLayoutRect,
  TimelineGeometryConfig,
  AudioDragTarget,
  AudioLaneHit,
  LaneDropPolicy,
  LaneHit,
  OverlayDragTarget,
  TimelineDropTarget,
  VideoLaneHit,
  SnapTimeResult,
  SnappingPolicy,
} from "@motionvideo/editor-core";

export {
  DEFAULT_VISUAL_POLICY,
  isAudioClip,
  isBaseLaneObj,
  isOverlayLaneObj,
  isSceneClip,
  isVisualLane,
  documentFromStoreState,
  storeStateFromDocument,
  validateTimelineDocument,
  assertNever,
  clipCapabilities,
  clipsById,
  clipsByLane,
  contentEndSeconds,
  lanesById,
  visualCompositionIndex,
  clipsIntersectingRange,
  clipsVisibleWithPins,
  visibleTimeRange,
  executeTimelineCommand,
  canRedo,
  canUndo,
  clearHistory,
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
  TimelineGeometry,
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
  CYAN_MODE_BELOW_RULER_TOP_PX,
  INDICATOR_TOP_EPS_PX,
  LANE_INSERT_ENTER_PX,
  LANE_INSERT_EXIT_PX,
  audioDropPolicy,
  audioHitToLane,
  resolveAudioDragTarget,
  resolveLaneDropTarget,
  resolveOverlayDragTarget,
  videoHitToLane,
  visualDropPolicy,
  defaultSnappingPolicy,
  getSnappingPolicy,
  setSnappingPolicy,
} from "@motionvideo/editor-core";

// Interaction sessions stay in web (DOM / pointer machines)
export type {
  PointerPos,
  PointerSessionConfig,
  SessionState,
} from "@/lib/editor/timeline/sessions/pointer-session-controller";

export { PointerSessionController } from "@/lib/editor/timeline/sessions/pointer-session-controller";

export type { MoveSessionState } from "@/lib/editor/timeline/sessions/clip-move-session";
export {
  buildClipMovePatch,
  createClipMoveSessionState,
  updateClipMoveSessionState,
} from "@/lib/editor/timeline/sessions/clip-move-session";

export type { LibraryDropSessionState } from "@/lib/editor/timeline/sessions/library-drop-session";
export {
  buildPlacementTarget,
  createLibraryDropSessionState,
  updateLibraryDropSessionState,
} from "@/lib/editor/timeline/sessions/library-drop-session";

export type {
  MarqueeBox,
  MarqueeSessionState,
} from "@/lib/editor/timeline/sessions/marquee-select-session";
export {
  createMarqueeSessionState,
  updateMarqueeSessionState,
} from "@/lib/editor/timeline/sessions/marquee-select-session";
