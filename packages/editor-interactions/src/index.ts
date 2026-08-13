export type { Point, PointerPos } from "./common/point";
export {
  type PointerModifiers,
  EMPTY_POINTER_MODIFIERS,
} from "./common/modifiers";
export {
  type Scheduler,
  syncScheduler,
  browserScheduler,
} from "./common/scheduler";

export {
  type PointerSessionEndReason,
  shouldCommitPointerSession,
} from "./pointer/pointer-session";
export {
  type InteractionCoordinator,
  createInteractionCoordinator,
  defaultInteractionCoordinator,
} from "./pointer/interaction-coordinator";
export {
  type SessionState,
  type PointerSessionConfig,
  type PointerSessionControllerOptions,
  PointerSessionController,
  resetActivePointerSessionToken,
} from "./pointer/pointer-session-controller";

export {
  TIMELINE_PLAYHEAD_GUTTER_PX,
  type TimelineViewportMetrics,
} from "./timeline/coordinates";
export {
  PLAYHEAD_SCRUB_EDGE_PX,
  PLAYHEAD_SCRUB_STEP_PX,
  PLAYHEAD_FOLLOW_MARGIN_PX,
  metricsFromScrollElement,
  clientPointToTimelineTime,
  clientPointToStripTime,
  timelineTimeToViewportLeft,
  timelineTimeToContentLeft,
  computePlayheadFollowScroll,
  computeHorizontalEdgeScroll,
  ensurePlayheadScrubScrollMetrics,
  resolvePlayheadScrubMax,
  clientXToTimelineTime,
  clientXToStripTime,
  scrollTracksHorizontallyNearEdge,
  ensurePlayheadScrubScroll,
} from "./timeline/seek";
export {
  computeAutoScrollNearEdge,
  autoScrollElementNearEdge,
  type AutoScrollNearEdgeOptions,
  type AutoScrollDelta,
} from "./timeline/auto-scroll";
export {
  type ClipMovePreviewMember,
  type ClipMovePreview,
  type ClipMoveDropTarget,
  type ClipMoveDragInput,
  type ClipMoveDragCommit,
  type ClipMoveDragResult,
  clipAcceptsTrack,
  lowerBound,
  collectClipEdgeSnapPoints,
  snapMoveStartToEdges,
  resolveClipMoveDrag,
} from "./timeline/clip-move";
export {
  type ClipTrimEdge,
  type ClipTrimPreview,
  resolveClipTrimUpdate,
} from "./timeline/clip-trim";
export {
  type LayerTimingLocal,
  clampNodeLocalTiming,
} from "./timeline/layer-timing";
export {
  reorderLayerLayerIds,
  reorderLayerLayerIdsByInsert,
} from "./timeline/layer-reorder";
export {
  type MarqueeRect,
  type MarqueeIndexedClip,
  type MarqueeHitContext,
  MARQUEE_TRACK_BOTTOM_PAD_PX,
  normalizeMarquee,
  rectsIntersect,
  clipIdsInMarquee,
  resolveMarqueeSelectionIds,
  selectionIdsEqual,
  shouldPublishMarqueeIds,
  commitMarqueeSelectionIds,
  marqueeTrackScrollBounds,
  clipIdsInMarqueeIndexed,
} from "./timeline/marquee";
export type { TimelineDropTargetHint } from "./timeline/drop-target";
export {
  resolveDropGeometry,
  type DropGeometryResult,
  type DropGeometryPureInput,
} from "./timeline/drop-geometry";
export type { MoveSessionState } from "./timeline/clip-move-session";
export {
  buildClipMovePatch,
  createClipMoveSessionState,
  updateClipMoveSessionState,
} from "./timeline/clip-move-session";
export type { LibraryDropSessionState } from "./timeline/library-drop-session";
export {
  buildPlacementTarget,
  createLibraryDropSessionState,
  updateLibraryDropSessionState,
} from "./timeline/library-drop-session";

export {
  type StagePoint,
  type StageViewportMetrics,
  clientToComposition,
  compositionToClient,
  type StageHitTestOptions,
  type StageHitResult,
  resolveStageHit,
  type ResizeHandle,
  type StageHandle,
  type StageTransformValues,
  type StageBounds,
  type SelectionBox,
  selectionBoxFromWorldAndDelta,
  hitTestHandle,
  pointInSelectionBox,
  type StageGuide,
  type StageConstraintInput,
  applyMoveConstraints,
  applyResizeConstraints,
  applyRotateConstraints,
  applyMoveDelta,
  applyResizeDelta,
  applyRotateDelta,
  type StageInteractionMode,
  type StagePreviewPayload,
  type StageSessionCallbacks,
  type BeginMoveArgs,
  type BeginResizeArgs,
  type BeginRotateArgs,
  type StageSession,
  createStageSession,
  type StagePropertyPatch,
  type StageCommitResult,
  toStagePropertyPatches,
  toSetNodeTransformCommand,
} from "./stage";
