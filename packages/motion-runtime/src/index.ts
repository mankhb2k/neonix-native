/** Canonical backend-neutral Runtime V3 public API. */
export * from "./matrix4";
export {
  flattenPathContour,
  interpolatePathContours,
  tessellateClosedPath,
  tessellatePathStroke,
  type PathStrokeOptions,
} from "./path-tessellation";
export {
  frameIndexAtTime,
  frameTimestamp,
  quantizeTimeToFrame,
  type FrameTimestamp,
} from "./clock";
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
} from "./determinism";
export * from "./media-timing";
export * from "./capability-ledger";
export * from "./runtime-hash";
// Keep the public runtime surface explicit. The old Canvas2D/affine adapters
// remain editor-local implementation details and must not become
// part of the backend-neutral runtime contract again.
export * from "./paint/paint-command";
export * from "./paint/paint-buffer";
export * from "./paint/paint-types";
export * from "./paint/paint-display-list";
export * from "./paint/validate-paint-command-buffer";
export * from "./paint/decode-paint-command-buffer";
export * from "./paint/paint-capabilities";
export * from "./paint/paint-buffer-contract";
export * from "./paint/paint-resource-descriptor";
export * from "./paint/paint-item-fingerprint";
/** Runtime V3 is the source of truth for compiler/playback consumers. */
export * from "./v3";
// Backend-neutral visual effect IR remains public; Runtime V2 project/audio
// contracts are intentionally not exported from the canonical root.
export { buildRuntimeEffectProgram } from "./v3/visual-internals/effects";
export {
  assertRuntimeEffectProgram,
  validateRuntimeEffectProgram,
  RUNTIME_EFFECT_SOURCE_SURFACE,
  type RuntimeAlphaMaskEffectOp,
  type RuntimeInnerAlphaEffectOp,
  type RuntimeBlurEffectOp,
  type RuntimeColorAdjustEffectOp,
  type RuntimeCompositeEffectOp,
  type RuntimeEffectOp,
  type RuntimeEffectProgram,
  type RuntimeEffectProgramDiagnostic,
  type RuntimeOffsetEffectOp,
  type RuntimeNoiseEffectOp,
  type RuntimeTintEffectOp,
  type SurfaceRef,
} from "./v3/visual-internals/effect-program";
