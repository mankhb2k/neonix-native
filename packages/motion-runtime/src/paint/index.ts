export {
  assertNeverPaintOp,
  type PaintCommand,
  type PaintDrawCommand,
  type RenderDiagnostic,
} from "./paint-command";
export {
  PAINT_COMMAND_VERSION,
  type PaintCommandBuffer,
} from "./paint-buffer";
export type {
  PaintFill,
  PaintFillGradient,
  PaintFillSolid,
  PathContour,
  PathMesh,
  PathStrokeMesh,
  PathStrokeJoin,
  PathStrokeCap,
  PathStrokeDash,
  RenderMediaFit,
  RenderNormalizedRect,
  RuntimeEffect,
} from "./paint-types";
export {
  type PaintDisplayList,
  type PaintDisplayNode,
  type PaintDrawable,
  type PaintGroupScope,
  type PaintLayerScope,
  type PaintTransformState,
  type PaintValidateIssue,
  type PaintValidateResult,
} from "./paint-display-list";
export { validatePaintCommandBuffer } from "./validate-paint-command-buffer";
export { decodePaintCommandBuffer } from "./decode-paint-command-buffer";
export {
  PAINT_OP_CAPABILITIES,
  getPaintOpCapability,
  resolvePaintFallback,
  type PaintFallbackPolicy,
  type PaintOpCapability,
} from "./paint-capabilities";
export {
  paintContractVersion,
  validatePaintBuffer,
  assertValidPaintBuffer,
  countUnsupportedCommands,
  collectPaintDiagnostics,
} from "./paint-buffer-contract";
export {
  type EvaluatedGeometry,
  type Affine2DGeometry,
  type ProjectedQuadGeometry,
  type MeshGeometry,
  type Bounds2D,
  type Vec2,
  makeAffine2DGeometry,
  identityAffine2DGeometry,
  flattenToAffine2D,
  isAffine2D,
} from "./evaluated-geometry";
export {
  type PaintResourceDescriptor,
  type PaintTextResource,
  type PaintShapeResource,
  type PaintImageResource,
  type PaintVideoResource,
  type PaintPathResource,
  type PaintFrameProperty,
  type SplitPaintCommand,
  extractPaintResource,
  extractPaintFrameProperty,
  splitPaintCommand,
} from "./paint-resource-descriptor";
export {
  computePaintItemFingerprint,
  computePaintResourceFingerprint,
} from "./paint-item-fingerprint";
export {
  replayPaintCommands2D,
  type Canvas2DReplayContext,
  type ReplayPaint2DOptions,
  type Replay2DImageSource,
} from "./replay-2d";
