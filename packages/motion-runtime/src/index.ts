/** V2-only runtime public API. */
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
} from "./determinism";
export * from "./media-timing";
export * from "./capability-ledger";
export * from "./runtime-hash";
// Keep the public runtime surface explicit. The old Canvas2D/affine adapters
// remain editor-local implementation details and must not become
// part of Runtime V2 again.
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
export * from "./v2";
