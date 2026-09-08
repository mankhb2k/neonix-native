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
export {
  type StageLayerBounds,
  isV2VisualLayer,
  isV2LayerActiveAtTime,
  getV2LayerWorldQuad,
  isPointInsideV2Layer,
  getV2LayerBounds,
  getV2LayerSelectionBox,
  getSelectionBounds,
  buildV2MovePatches,
  buildV2ResizePatch,
  buildV2RotatePatch,
} from "./v2-transform";
export {
  KEYFRAME_TIME_TOLERANCE_MS,
  type PlayheadTransformEdit,
  type PlayheadTransformOptions,
  layerLocalTimeAtPlayhead,
  isLayerKeyframedAtTime,
  buildPlayheadTransformPatch,
  buildPlayheadTransformPatches,
  buildPlayheadPropertyPatch,
  toggleNumericKeyframePatch,
  type PlayheadPropertyPath,
} from "./keyframes";
export {
  buildStageTransformCommand,
  type StageTransformCommandInput,
} from "./command";
export {
  buildIntrinsicTextFrameUpdate,
  buildWrappedTextResizeUpdate,
  buildTextScaleResizeUpdate,
  buildStageTextResizeCommand,
  type StageTextFrameUpdate,
  type StageTextLayoutMeasurement,
  type WrappedTextResizeOptions,
  type TextScaleResizeOptions,
} from "./text-resize";
export {
  type AnchorPoint,
  type TranslatePoint,
  type LayerBounds,
  type AlignmentPatch,
  getLayerBounds,
  buildAlignmentPatches,
  compensateAnchor,
} from "./alignment";
