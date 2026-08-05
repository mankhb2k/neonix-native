/**
 * Remotion-free preview helpers: timeline resolve, composition evaluate, demo fixtures.
 * Web core + Pixi path import from here; Remotion stays an optional fallback adapter.
 */

export {
  evaluateCompositionSnapshot,
  compositionDurationInFrames,
} from "./evaluate-composition";
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
  TimelineProjectLike,
  TimelineRuntime,
} from "./resolve-timeline";
