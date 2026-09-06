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
  type StageMoveSnap,
  applyMoveConstraints,
  applyResizeConstraints,
  applyRotateConstraints,
} from "./constraints";
export {
  type StageSnapTarget,
  type StageSnapResult,
  computeSelectionSnap,
} from "./snap";
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
  type StageLayerPatch,
  type StageCommitResult,
  toStageLayerPatches,
  toStageDocumentCommand,
} from "./commit";
