import type { Matrix4 } from "../matrix4";
import type { PaintCommandBuffer } from "../paint";
import type {
  PaintFill,
  PaintTextGlyph,
  PaintTextLine,
  PathContour,
  PathMesh,
  PathStrokeCap,
  PathStrokeDash,
  PathStrokeJoin,
  PathStrokeMesh,
  RenderMediaFit,
  RenderNormalizedRect,
  RuntimeEffect,
} from "../paint/paint-types";

export type RuntimeCompositionV2 = {
  width: number;
  height: number;
  fps: number;
  /** Compiler V2 emits the max visual/audio end time. */
  duration?: number;
  background?: string;
  graphId: string;
};

export type RuntimeAudioFadeCurveV2 = "linear" | "equal-power";

export type RuntimeAudioFadeV2 = {
  duration: number;
  curve: RuntimeAudioFadeCurveV2;
};

/** Immutable source metadata resolved from an Atomic Protocol V2 asset. */
export type RuntimeAudioSourceV2 = {
  assetId: string;
  kind: "audio" | "video";
  uri: string;
  mimeType?: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  integrity?: string;
};

export type RuntimeAudioClipV2 = {
  id: string;
  assetId: string;
  source: RuntimeAudioSourceV2;
  timing: RuntimeTimingV2;
  trim: {
    start: number;
    end?: number;
  };
  playbackRate: number;
  loop: boolean;
  gainDb: number;
  fadeIn?: RuntimeAudioFadeV2;
  fadeOut?: RuntimeAudioFadeV2;
};

export type RuntimeAudioTrackV2 = {
  id: string;
  gainDb: number;
  pan: number;
  muted: boolean;
  clips: RuntimeAudioClipV2[];
};

export type RuntimeAudioProjectV2 = {
  sampleRate: 48000;
  tracks: RuntimeAudioTrackV2[];
};

export type RuntimeAudioFadeProgressV2 = {
  curve: RuntimeAudioFadeCurveV2;
  start: number;
  end: number;
};

export type RuntimeAudioGainEnvelopeV2 = {
  baseGain: number;
  fadeIn?: RuntimeAudioFadeProgressV2;
  fadeOut?: RuntimeAudioFadeProgressV2;
};

export type RuntimeAudioMixSegmentV2 = {
  compositionStartSample: number;
  compositionEndSample: number;
  sourceStartSample: number;
  sourceEndSample: number;
  loopIndex: number;
  gainEnvelope: RuntimeAudioGainEnvelopeV2;
};

export type RuntimeAudioMixInputV2 = {
  trackId: string;
  clipId: string;
  assetId: string;
  source: RuntimeAudioSourceV2;
  sourceSampleRate: number;
  pan: number;
  muted: boolean;
  compositionStartSample: number;
  compositionEndSample: number;
  segments: RuntimeAudioMixSegmentV2[];
};

export type RuntimeAudioMixPlanV2 = {
  sampleRate: 48000;
  startSample: number;
  endSample: number;
  inputs: RuntimeAudioMixInputV2[];
};

export type RuntimeViewV2 = {
  /** The only view value Runtime V2 exposes to painters: world space to clip space. */
  worldToClipMatrix: Matrix4;
};

export type RuntimeTimingV2 = {
  start: number;
  duration: number;
};

export type RuntimeBlendModeV2 = "normal" | "multiply" | "screen" | "add";

/** Runtime-normalized group mask relation. */
export type RuntimeMaskV2 = {
  mode: "clip" | "alpha" | "inverse-alpha" | "luma";
  sourceId: string;
};

export type RuntimeShapeV2 = {
  kind: "shape";
  shape: "rectangle" | "ellipse";
  width: number;
  height: number;
  fill: string;
  fillPaint?: PaintFill;
  fillOpacity?: number;
  cornerRadius?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  effects?: RuntimeEffect[];
};

export type RuntimePathV2 = {
  kind: "path";
  width: number;
  height: number;
  contours: PathContour[];
  mesh?: PathMesh;
  strokeMesh?: PathStrokeMesh;
  fillRule: "nonzero" | "evenodd";
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeJoin?: PathStrokeJoin;
  strokeCap?: PathStrokeCap;
  strokeDash?: PathStrokeDash;
  effects?: RuntimeEffect[];
};

export type RuntimeImageV2 = {
  kind: "image";
  assetId: string;
  uri?: string;
  width: number;
  height: number;
  fit?: RenderMediaFit;
  crop?: RenderNormalizedRect;
  effects?: RuntimeEffect[];
};

export type RuntimeVideoV2 = {
  kind: "video";
  assetId: string;
  uri?: string;
  width: number;
  height: number;
  fit?: RenderMediaFit;
  trimStart: number;
  trimEnd?: number;
  sourceDuration?: number;
  sourceFps: number;
  loop: boolean;
  muted: boolean;
  framePolicy: "floor" | "round" | "ceil";
  effects?: RuntimeEffect[];
};

export type RuntimeTextLayoutV2 = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  glyphs: PaintTextGlyph[];
  lines: PaintTextLine[];
};

/** Text stays semantic until the host has resolved the exact font binary. */
export type RuntimeTextV2 = {
  kind: "text";
  text: string;
  fontAssetId: string;
  fontUri: string;
  fontIntegrity: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  wrap: "none";
  overflow: "visible";
  direction: "ltr";
  language: string;
  fill: string;
  width: number;
  height: number;
  layout?: RuntimeTextLayoutV2;
  effects?: RuntimeEffect[];
};

/**
 * Runtime-only hierarchy marker. It never becomes a GPU draw, but preserves
 * the point at which a subtree must be flattened before one group opacity is
 * composited back into its parent.
 */
export type RuntimeGroupV2 = {
  kind: "group";
  width: number;
  height: number;
};

export type RuntimeNodeV2 = {
  id: string;
  parentId: string | null;
  /** Paint order within this node's sibling scope. */
  order: number;
  timing: RuntimeTimingV2;
  opacity: number;
  /** Omitted only for older in-memory Runtime test fixtures; Compiler V2 emits it. */
  blendMode?: RuntimeBlendModeV2;
  mask?: RuntimeMaskV2;
  visible: boolean;
  localMatrix: Matrix4;
  worldMatrix: Matrix4;
  content:
    | RuntimeGroupV2
    | RuntimeShapeV2
    | RuntimePathV2
    | RuntimeImageV2
    | RuntimeVideoV2
    | RuntimeTextV2;
};

export type RuntimeProjectV2 = {
  format: "motion-runtime";
  formatVersion: 2;
  id: string;
  composition: RuntimeCompositionV2;
  view: RuntimeViewV2;
  nodes: RuntimeNodeV2[];
  /** Compiler V2 always emits this; older in-memory fixtures may omit it. */
  audio?: RuntimeAudioProjectV2;
};

export type RuntimeDiagnosticV2 = {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
};

export type RuntimeValidationV2 = {
  ok: boolean;
  diagnostics: RuntimeDiagnosticV2[];
};

export type RuntimeFrameV2 = PaintCommandBuffer & {
  runtimeFormat: "motion-runtime";
  runtimeVersion: 2;
  frame: number;
  time: number;
};
