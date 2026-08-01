/**
 * @motionvideo/editor-core — pure timeline/document domain (no React/DOM/Zustand).
 */

export * from "./ports/command-context";
export * from "./frame-draft";
export * from "./selection/editor-selection";
export * from "./selection/editor-selectors";
export * from "./timeline/model/timeline-types";
export * from "./document/document";
export * from "./timeline/timeline-clips";
export * from "./timeline/assert-never";
export * from "./timeline/clip-capabilities";
export * from "./timeline/indexes";
export * from "./timeline/selectors/visible-range";
export * from "./timeline/geometry/timeline-geometry";
export * from "./timeline/policies/snapping-policy";
export * from "./timeline/policies/zoom-fit-policy";
export * from "./timeline/policies/drop-target-policy";
export * from "./history/history-types";
export * from "./history/history-manager";
export * from "./history/coalesce";
export * from "./timeline/clip-clipboard";
export * from "./overlay-scenes";
export * from "./properties/types";
export * from "./properties/mixed";
export * from "./properties/property-commands";
export * from "./properties/execute-property-command";
export * from "./properties/resolve-targets";
export * from "./properties/registry";
export type {
  AudioLibraryItem,
  PlacementTarget,
  ClipMovePatch,
  TimelineCommand,
  TimelineDomainEvent,
  TimelineLaneFlags,
  CommandResult,
} from "./timeline/commands/command-types";
export { executeTimelineCommand } from "./timeline/commands/command-runner";

export type {
  VisualPlacementIntent,
  PlacementResult,
  VisualPlacementResult,
  AudioPlacementResult,
  AudioPlacementIntent,
} from "./operations/clip-move";
export {
  resolveVisualPlacement,
  resolveAudioPlacementIntent,
  applyRippleAfter,
  createOverlayLaneAt,
} from "./operations/clip-move";

export type { LaneFlagPatch } from "./operations/lane-flags";
export {
  applyLaneFlagPatch,
  selectionHasLockedLane,
  isLaneMuted,
  isLaneHidden,
} from "./operations/lane-flags";

/** Compat surface previously under apps/web store/internal */
export {
  uid,
  nodeText,
  updateVariable,
  mapNode,
  sceneFromFrameDraft,
  cloneSceneWithNewIds,
  stageSizeForAspect,
  type CompositionSize,
} from "./timeline/internal/scene-utils";
export {
  applyVisualPlacement,
  applyAudioPlacement,
  resolveOverlayPlacement,
  resolveAudioPlacement,
  audioLaneIdByOrder,
} from "./timeline/internal/placement-adapter";
export { resolveCollisionsAfterResize } from "./timeline/internal/resize-collision";
export { rebuildMainProject } from "./timeline/internal/timeline-project-sync";
