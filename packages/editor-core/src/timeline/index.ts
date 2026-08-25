export {
  projectLayersToTimeline,
  MAIN_LANE_ID,
  type LayerTimelineProjection,
} from "./selectors/layer-timeline-projection";
export {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
  type AudioTimelineClip,
  type AudioTimelineLane,
  type SceneTimelineClip,
  type VisualTimelineLane,
  type VisualMediaType,
  type TimelineTrackKind,
} from "./model/timeline-types";
export {
  TIMELINE_ZOOM_MIN,
  TIMELINE_ZOOM_MAX,
  TIMELINE_ZOOM_DEFAULT,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_RULER_HEIGHT_PX,
  capCutRulerScale,
  formatRulerLabel,
  formatTimecode,
  type CapCutRulerScale,
} from "./policies/capcut-ruler-scale";
export {
  computeRulerTickWindow,
  type ComputeRulerTickWindowInput,
  type RulerTick,
} from "./policies/ruler-ticks";

// Canonical timeline surface. This barrel replaces the former
// runtime barrel; browser hosts should import timeline models,
// policies, geometry, selectors and pure timeline interactions from here.
export * from "./geometry/lane-rows";
export * from "./geometry/viewport-layout";
export * from "./policies/drop-target-policy";
export * from "./policies/zoom-fit-policy";
export * from "./selectors/track-kind";
export * from "./selectors/visible-range";
export * from "../selection/editor-selection";
export * from "../frame-draft";
export { MIN_CLIP_SLICE_SEC } from "./clip-clipboard";
export type {
  AudioLibraryItem,
  ClipMovePatch,
  CommandResult,
  PlacementTarget,
  TimelineCommand,
  TimelineDomainEvent,
  TimelineEdit,
  TimelineLaneFlags,
} from "./commands/command-types";
export {
  timelineEditToDocumentCommand,
  timelineLanesForDocument,
} from "./commands/to-document-command";
export type { TimelineViewportMetrics } from "../interactions/timeline/coordinates";
export * from "../interactions/timeline/seek";
export * from "../interactions/timeline/auto-scroll";
export * from "../interactions/timeline/clip-move";
export * from "../interactions/timeline/clip-trim";
export * from "../interactions/timeline/marquee";
export * from "../interactions/timeline/clip-group-move-plan";
