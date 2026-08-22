/**
 * Public API của stage transform: tọa độ, hit-test, handle, ràng buộc, phiên và commit.
 */

export {
  type StagePoint,
  type StageViewportMetrics,
  clientToComposition,
  compositionToClient,
} from "./coordinates";
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
  toSingleSetNodeTransformCommand,
} from "./commit";
