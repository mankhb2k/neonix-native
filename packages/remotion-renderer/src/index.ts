/**
 * Optional Remotion composition adapter (fallback preview only).
 * Core timeline/fixtures live in `@motionvideo/preview-kit`.
 */

export { MotionComposition } from "./MotionComposition";
export type { MotionCompositionProps } from "./MotionComposition";
export { RemotionSnapshotRenderer } from "./RemotionSnapshotRenderer";
export type { RemotionSnapshotRendererProps } from "./RemotionSnapshotRenderer";
export { Player } from "@remotion/player";
export type { PlayerRef } from "@remotion/player";

export {
  evaluateCompositionSnapshot,
  compositionDurationInFrames,
  createDemoMotionProject,
  DEMO_SCENE_ID,
  createFacebookHistoryDemoProject,
  FB_HISTORY_SCENE_IDS,
  resolveTimelineAtTime,
  listTimelineSegments,
  timelineTotalDuration,
} from "@motionvideo/preview-kit";
export type {
  TimelineResolveResult,
  TimelineSceneSegment,
  TimelineProjectLike,
  TimelineRuntime,
} from "@motionvideo/preview-kit";
