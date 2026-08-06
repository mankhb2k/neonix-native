/**
 * Optional Remotion composition adapter.
 * Timeline helpers live in `@motionvideo/motion-runtime`.
 */

export { MotionComposition } from "./MotionComposition";
export type { MotionCompositionProps } from "./MotionComposition";
export { MotiClipVideo } from "./MotiClipVideo";
export type { MotiClipVideoProps } from "./MotiClipVideo";
export { RemotionSnapshotRenderer } from "./RemotionSnapshotRenderer";
export type { RemotionSnapshotRendererProps } from "./RemotionSnapshotRenderer";
export { RemotionPaintRenderer } from "./RemotionPaintRenderer";
export { Player } from "@remotion/player";
export type { PlayerRef } from "@remotion/player";

export {
  evaluateCompositionSnapshot,
  evaluateCompositionFrame,
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
