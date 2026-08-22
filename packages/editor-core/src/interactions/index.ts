/**
 * Pure editor interaction domain. Browser hosts supply pointer listeners,
 * viewport measurements, animation scheduling, and scroll writes themselves.
 */
export type { Point, PointerPos } from "./common/point";
export { EMPTY_POINTER_MODIFIERS, type PointerModifiers } from "./common/modifiers";
export { syncScheduler, type Scheduler } from "./common/scheduler";

export { shouldCommitPointerSession, type PointerSessionEndReason } from "./pointer/pointer-session";
export {
  createInteractionCoordinator,
  defaultInteractionCoordinator,
  type InteractionCoordinator,
} from "./pointer/interaction-coordinator";
export {
  PointerSessionController,
  resetActivePointerSessionToken,
  type PointerSessionConfig,
  type PointerSessionControllerOptions,
  type SessionState,
} from "./pointer/pointer-session-controller";

export type { TimelineViewportMetrics } from "./timeline/coordinates";
export {
  DEFAULT_TIMELINE_TRACKS_ORIGIN_X,
  PLAYHEAD_FOLLOW_MARGIN_PX,
  PLAYHEAD_SCRUB_EDGE_PX,
  PLAYHEAD_SCRUB_STEP_PX,
  clientPointToStripTime,
  clientPointToTimelineTime,
  computeHorizontalEdgeScroll,
  computePlayheadFollowScroll,
  ensurePlayheadScrubScrollMetrics,
  resolvePlayheadScrubMax,
  timelineTimeToContentLeft,
  timelineTimeToViewportLeft,
} from "./timeline/seek";
export {
  computeAutoScrollNearEdge,
  type AutoScrollDelta,
  type AutoScrollNearEdgeOptions,
} from "./timeline/auto-scroll";
export {
  clipAcceptsTrack,
  collectClipEdgeSnapPoints,
  lowerBound,
  resolveClipMoveDrag,
  snapMoveStartToEdges,
  type ClipMoveDragCommit,
  type ClipMoveDragInput,
  type ClipMoveDragResult,
  type ClipMoveDropTarget,
  type ClipMovePreview,
  type ClipMovePreviewMember,
} from "./timeline/clip-move";
export { resolveClipTrimUpdate, type ClipTrimEdge, type ClipTrimPreview } from "./timeline/clip-trim";
export { clampNodeLocalTiming, type LayerTimingLocal } from "./timeline/layer-timing";
export {
  reorderLayerIds,
  reorderLayerIdsByInsert,
  reorderLayerLayerIds,
  reorderLayerLayerIdsByInsert,
} from "./timeline/layer-reorder";
export {
  MARQUEE_TRACK_BOTTOM_PAD_PX,
  clipIdsInMarquee,
  clipIdsInMarqueeIndexed,
  commitMarqueeSelectionIds,
  marqueeTrackScrollBounds,
  normalizeMarquee,
  rectsIntersect,
  resolveMarqueeSelectionIds,
  selectionIdsEqual,
  shouldPublishMarqueeIds,
  type MarqueeHitContext,
  type MarqueeIndexedClip,
  type MarqueeRect,
} from "./timeline/marquee";
export type { TimelineDropTargetHint } from "./timeline/drop-target";
export { resolveDropGeometry, type DropGeometryPureInput, type DropGeometryResult } from "./timeline/drop-geometry";
export {
  buildClipMovePatch,
  createClipMoveSessionState,
  updateClipMoveSessionState,
  type MoveSessionState,
} from "./timeline/clip-move-session";
export {
  buildPlacementTarget,
  createLibraryDropSessionState,
  updateLibraryDropSessionState,
  type LibraryDropSessionState,
} from "./timeline/library-drop-session";

export {
  clientToComposition,
  compositionToClient,
  type StagePoint,
  type StageViewportMetrics,
} from "./stage/coordinates";
export {
  hitTestHandle,
  pointInSelectionBox,
  selectionBoxFromWorldAndDelta,
  type ResizeHandle,
  type SelectionBox,
  type StageBounds,
  type StageHandle,
  type StageTransformValues,
} from "./stage/transform-box";
export {
  applyMoveConstraints,
  applyResizeConstraints,
  applyRotateConstraints,
  type StageConstraintInput,
  type StageGuide,
} from "./stage/constraints";
export { applyMoveDelta, applyResizeDelta, applyRotateDelta } from "./stage/sessions/math";
export {
  createStageSession,
  type BeginMoveArgs,
  type BeginResizeArgs,
  type BeginRotateArgs,
  type StageInteractionMode,
  type StagePreviewPayload,
  type StageSession,
  type StageSessionCallbacks,
} from "./stage/sessions/session";
export {
  toSingleSetNodeTransformCommand,
  toStagePropertyPatches,
  type StageCommitResult,
  type StagePropertyPatch,
} from "./stage/commit";
