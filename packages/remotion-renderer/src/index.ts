export {
  MotionComposition,
} from "./MotionComposition";
export type { MotionCompositionProps } from "./MotionComposition";
export {
  evaluateCompositionSnapshot,
  compositionDurationInFrames,
} from "./evaluate-composition";
export { RemotionSnapshotRenderer } from "./RemotionSnapshotRenderer";
export type { RemotionSnapshotRendererProps } from "./RemotionSnapshotRenderer";
export { createDemoMotionProject, DEMO_SCENE_ID } from "./fixtures/demo-project";
export {
  createFacebookHistoryDemoProject,
  FB_HISTORY_SCENE_IDS,
} from "./fixtures/facebook-history-demo";
export {
  resolveTimelineAtTime,
  listTimelineSegments,
  timelineTotalDuration,
} from "./resolve-timeline";
export type {
  TimelineResolveResult,
  TimelineSceneSegment,
} from "./resolve-timeline";
