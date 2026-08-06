export {
  type StagePoint,
  type StageViewportMetrics,
  clientToComposition,
  compositionToClient,
} from "./coordinates";
export {
  type StageHitTestOptions,
  type StageHitResult,
  resolveStageHit,
} from "./hit-test-policy";
export {
  type ResizeHandle,
  type StageHandle,
  type StageTransformValues,
  type StageBounds,
  type SelectionBox,
  selectionBoxFromWorldAndDelta,
  hitTestHandle,
  pointInSelectionBox,
} from "./transform-box";
export {
  type StageGuide,
  type StageConstraintInput,
  applyMoveConstraints,
  applyResizeConstraints,
  applyRotateConstraints,
} from "./constraints";
export {
  applyMoveDelta,
  applyResizeDelta,
  applyRotateDelta,
} from "./sessions/math";
export {
  type StageInteractionMode,
  type StagePreviewPayload,
  type StageSessionCallbacks,
  type BeginMoveArgs,
  type BeginResizeArgs,
  type BeginRotateArgs,
  type StageSession,
  createStageSession,
} from "./sessions/session";
export {
  type StagePropertyPatch,
  type StageCommitResult,
  toStagePropertyPatches,
  toSetNodeTransformCommand,
} from "./commit";
