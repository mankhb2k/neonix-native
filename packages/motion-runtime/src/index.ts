/** Canonical backend-neutral Runtime V3 public API. */

export * from "./geometry/matrix4";
export {
  flattenPathContour,
  flattenPathContourAny,
  measureContour,
  sampleContourAtDistance,
  interpolatePathContours,
  tessellateClosedPath,
  tessellatePathStroke,
  tessellateNonScalingStroke,
  isAffine2DMatrix,
  type PathStrokeOptions,
} from "./geometry/path";

export {
  frameIndexAtTime,
  frameTimestamp,
  quantizeTimeToFrame,
  type FrameTimestamp,
} from "./foundation/clock";
export {
  FRAME_EPSILON,
  GEOMETRY_EPSILON,
  LENGTH_EPSILON,
  assertNoImplicitLocale,
  deterministicRandom,
  deterministicTieBreak,
  deterministicUint32,
  frameToTime,
  numericThenId,
  roundTimeToFrame,
  samplesToSeconds,
  secondsToSamples,
} from "./foundation/determinism";
export * from "./media/media-timing";
export * from "./foundation/runtime-hash";

export * from "./paint/paint-command";
export * from "./paint/paint-buffer";
export * from "./paint/paint-types";
export * from "./paint/paint-display-list";
export * from "./paint/validate-paint-command-buffer";
export * from "./paint/decode-paint-command-buffer";
export * from "./paint/paint-buffer-contract";
export * from "./paint/paint-resource-descriptor";
export * from "./paint/paint-item-fingerprint";
export * from "./paint/evaluated-geometry";
export * from "./paint/replay-2d";

export * from "./project/types";
export * from "./project/visual";
export * from "./project/resolve";
export * from "./project/duration";
export * from "./project/validate";
export * from "./project/identity";
export * from "./audio/offline-audio";
export * from "./audio/audio-mixing";

export { evaluateVisualRuntimeProject } from "./visual/evaluate";
export {
  assertVisualRuntimeFrame,
  assertVisualRuntimeProject,
  isVisualRuntimeProject,
  normalizeVisualRuntimeProject,
  validateVisualRuntimeProject,
} from "./visual/validate";
export { measureVisualRuntimeText, prepareVisualRuntimeProjectText } from "./visual/text-layout";
export type {
  VisualRuntimeComposition,
  VisualRuntimeFrame,
  VisualRuntimeMask,
  VisualRuntimeClipPath,
  VisualRuntimeNode,
  VisualRuntimeProject,
  VisualRuntimeTextLayout,
  GlyphRun,
  GlyphRunGlyph,
  VisualRuntimeTextSpan,
  VisualRuntimeText,
  VisualRuntimeView,
} from "./visual/types";
export type {
  VisualRuntimeTextFontResolver,
  VisualRuntimeTextFontSource,
  VisualRuntimeTextShaperLoader,
  TextLayoutMeasurement,
} from "./visual/text-layout";
export { buildRuntimeEffectProgram } from "./visual/effects";
export {
  assertRuntimeEffectProgram,
  validateRuntimeEffectProgram,
  RUNTIME_EFFECT_SOURCE_SURFACE,
  type RuntimeAlphaMaskEffectOp,
  type RuntimeAlphaEffectOp,
  type RuntimeInnerAlphaEffectOp,
  type RuntimeBlurEffectOp,
  type RuntimeColorAdjustEffectOp,
  type RuntimeColorMatrixEffectOp,
  type RuntimeCompositeEffectOp,
  type RuntimeEffectOp,
  type RuntimeEffectProgram,
  type RuntimeEffectProgramDiagnostic,
  type RuntimeOffsetEffectOp,
  type RuntimeNoiseEffectOp,
  type RuntimeTintEffectOp,
  type SurfaceRef,
} from "./visual/effect-program";
