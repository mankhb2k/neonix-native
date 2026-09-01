import type { Matrix4 } from "../geometry/matrix4";
import type { PaintCommandBuffer } from "../paint/paint-buffer";
import type {
  PaintFill,
  PaintMaskMode,
  PaintOrder,
  PaintTextGlyph,
  PaintTextLine,
  PathContour,
  PathMesh,
  PathStrokeCap,
  PathStrokeDash,
  PathStrokeJoin,
  PathStrokeMesh,
  PathVectorEffect,
  PathMarker,
  RenderMediaFit,
  RuntimeEffect,
} from "../paint/paint-types";

export type VisualRuntimeComposition = {
  width: number;
  height: number;
  fps: number;
  /** Runtime time in seconds; the V2 compiler converts protocol milliseconds. */
  duration?: number;
  background?: string;
  graphId: string;
};

export type VisualRuntimeView = {
  /** The only view value Runtime V2 exposes to painters: world space to clip space. */
  worldToClipMatrix: Matrix4;
};

export type VisualRuntimeTiming = {
  /** Runtime time values in seconds; Protocol V2 authoring values are ms. */
  start: number;
  duration: number;
};

export type VisualRuntimeBlendMode =
  | "normal"
  | "darken"
  | "multiply"
  | "color-burn"
  | "lighten"
  | "screen"
  | "color-dodge"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

/** Runtime-normalized group mask relation. */
export type VisualRuntimeMask = {
  mode: PaintMaskMode;
  sourceId: string;
  /** Multiple SVG definition children can contribute to one mask surface. */
  sourceIds?: string[];
};

/** Runtime-normalized SVG clipPath coverage relation. */
export type VisualRuntimeClipPath = {
  sourceId: string;
  sourceIds?: string[];
};

export type VisualRuntimeShape = {
  kind: "shape";
  shape: "rectangle" | "ellipse";
  width: number;
  height: number;
  fill: string;
  fillPaint?: PaintFill;
  fillOpacity?: number;
  cornerRadius?: number;
  stroke?: string;
  strokePaint?: PaintFill;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeMiterLimit?: number;
  strokeJoin?: PathStrokeJoin;
  strokeCap?: PathStrokeCap;
  strokeDash?: PathStrokeDash;
  vectorEffect?: PathVectorEffect;
  paintOrder?: PaintOrder;
  effects?: RuntimeEffect[];
};

export type VisualRuntimePath = {
  kind: "path";
  width: number;
  height: number;
  contours: PathContour[];
  mesh?: PathMesh;
  strokeMesh?: PathStrokeMesh;
  fillRule: "nonzero" | "evenodd";
  fill?: string;
  fillPaint?: PaintFill;
  fillOpacity?: number;
  stroke?: string;
  strokePaint?: PaintFill;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeMiterLimit?: number;
  strokeJoin?: PathStrokeJoin;
  strokeCap?: PathStrokeCap;
  strokeDash?: PathStrokeDash;
  vectorEffect?: PathVectorEffect;
  paintOrder?: PaintOrder;
  markers?: PathMarker[];
  effects?: RuntimeEffect[];
};

export type VisualRuntimeImage = {
  kind: "image";
  assetId: string;
  uri?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  preserveAspectRatio?: import("../paint/paint-types").RenderImagePreserveAspectRatio;
  imageRendering?: import("../paint/paint-types").RenderImageRendering;
  effects?: RuntimeEffect[];
};

export type VisualRuntimeVideo = {
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
  muted: boolean;
  framePolicy: "floor" | "round" | "ceil";
  effects?: RuntimeEffect[];
};

export type VisualRuntimeTextLayout = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  glyphs: PaintTextGlyph[];
  lines: PaintTextLine[];
};

/** Text stays semantic until the host has resolved the exact font binary. */
export type VisualRuntimeText = {
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
  layout?: VisualRuntimeTextLayout;
  effects?: RuntimeEffect[];
};

/**
 * Runtime-only hierarchy marker. It never becomes a GPU draw, but preserves
 * the point at which a subtree must be flattened before one group opacity is
 * composited back into its parent.
 */
export type VisualRuntimeGroup = {
  kind: "group";
  width: number;
  height: number;
  /** Runtime-lowered SVG filter/effect list for the complete subtree. */
  effects?: RuntimeEffect[];
  /** Runtime marker for CSS transform-style/perspective subtree handling. */
  render3d?: {
    transformStyle: "flat" | "preserve-3d";
    perspective?: { distance: number; origin: { x: number; y: number } };
  };
};

export type VisualRuntimeNode = {
  id: string;
  parentId: string | null;
  /** Paint order within this node's sibling scope. */
  order: number;
  timing: VisualRuntimeTiming;
  opacity: number;
  /** Omitted only for older in-memory Runtime test fixtures; Compiler V2 emits it. */
  blendMode?: VisualRuntimeBlendMode;
  /** SVG/CSS isolation semantic preserved through the compiler boundary. */
  isolation?: "auto" | "isolate";
  /** Compiler-preserved CSS backface-visibility state. */
  backfaceVisibility?: "visible" | "hidden";
  clipPath?: VisualRuntimeClipPath;
  mask?: VisualRuntimeMask;
  visible: boolean;
  localMatrix: Matrix4;
  worldMatrix: Matrix4;
  content:
    | VisualRuntimeGroup
    | VisualRuntimeShape
    | VisualRuntimePath
    | VisualRuntimeImage
    | VisualRuntimeVideo
    | VisualRuntimeText;
};

export type VisualRuntimeProject = {
  format: "motion-runtime";
  formatVersion: 2;
  id: string;
  composition: VisualRuntimeComposition;
  view: VisualRuntimeView;
  nodes: VisualRuntimeNode[];
};

export type VisualRuntimeDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
};

export type VisualRuntimeValidation = {
  ok: boolean;
  diagnostics: VisualRuntimeDiagnostic[];
};

export type VisualRuntimeFrame = PaintCommandBuffer & {
  runtimeFormat: "motion-runtime";
  runtimeVersion: 2;
  frame: number;
  time: number;
};
