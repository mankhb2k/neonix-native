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
  clientXToTimelineTime,
  clientXToStripTime,
  timelineTimeToViewportLeft,
  scrollTracksHorizontallyNearEdge,
  ensurePlayheadScrubScroll,
  resolvePlayheadScrubMax,
} from "./timeline/seek";
export {
  autoScrollElementNearEdge,
  type AutoScrollNearEdgeOptions,
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
