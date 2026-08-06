/**
 * Optional Remotion composition adapter (fallback preview only).
 * Timeline helpers live in `@motionvideo/motion-runtime`.
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
  resolveTimelineAtTime,
  listTimelineSegments,
  timelineTotalDuration,
} from "@motionvideo/motion-runtime";
export type {
  TimelineResolveResult,
  TimelineSceneSegment,
  TimelineProjectLike,
  TimelineRuntime,
} from "@motionvideo/motion-runtime";
