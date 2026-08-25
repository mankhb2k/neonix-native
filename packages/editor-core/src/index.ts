/**
 * @motionvideo/editor-core — pure timeline/document domain (no React/DOM/Zustand).
 */

export * from "./ports/command-context";
export * from "./frame-draft";
export * from "./selection/editor-selection";
export * from "./selection/editor-selectors";
export * from "./timeline/model/timeline-types";
export * from "./document/document";
export * from "./document/sanitize-editor-project";
export * from "./sugar";
export * from "./document/expand-authoring-to-core";
export * from "./document/canonical-projection";
export * from "./document/group";
export * from "./document/group-path";
export * from "./timeline/timeline-clips";
export * from "./timeline/assert-never";
export * from "./timeline/clip-capabilities";
export * from "./timeline/indexes";
export * from "./timeline/selectors/visible-range";
export * from "./timeline/selectors/track-kind";
export * from "./timeline/selectors/scene-order-clips";
export * from "./timeline/geometry/timeline-geometry";
export * from "./timeline/geometry/viewport-layout";
export * from "./timeline/geometry/lane-rows";
export * from "./timeline/layer-mode/build-layer-tree";
export * from "./timeline/actions/timeline-context-actions";
export * from "./timeline/policies/snapping-policy";
export * from "./timeline/policies/zoom-fit-policy";
export * from "./timeline/policies/capcut-ruler-scale";
export * from "./timeline/policies/ruler-ticks";
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
export {
  createClipGroupMovePlan,
  moveClipGroup,
  resolveClipGroupMove,
  uiTrackKindForLane,
  type ClipGroupMovePlan,
  type ClipGroupMoveResolve,
  type ClipGroupPlacement,
} from "./operations/clip-move-group";

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
  layerFromFrameDraft,
  cloneLayerWithNewIds,
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
export {
  rebuildMainProject,
  uniqueZIndexByLayerId,
} from "./timeline/internal/timeline-project-sync";

export type {
  PlaybackDriver,
  PlaybackDriverClock,
  PlaybackDriverDeps,
} from "./playback/playback-driver";
export { createPlaybackDriver } from "./playback/playback-driver";
export { playbackFrameIndex, playbackFrameTime } from "./playback/time-frame";

export type { ComposedLayer, VisualLaneIndex } from "./preview/compose-layers";
export {
  buildVisualLaneIndex,
  clipContainsTime,
  composeAtTime,
  composeVisualLayersAtTime,
  findActiveClipAtTime,
  resolveLayer,
} from "./preview/compose-layers";

export { clipLocalTime, sliceScene } from "./export/slice-scene";
export type { EditorExportSnapshot } from "./export/build-export-project";
export {
  buildExportProject,
  findBaseClipAtTimeForExport,
  resolveBakedLocalTime,
} from "./export/build-export-project";

// Pure pointer, timeline, and stage interaction algorithms. DOM/browser
// adapters deliberately remain in the host application.
export * from "./interactions";
