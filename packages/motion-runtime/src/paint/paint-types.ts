/** Backend-neutral paint data owned by the V2 runtime contract. */

export type PaintBlendMode =
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

export type PaintFillSolid = { type: "solid"; color: string };
export type PaintTransform = { a: number; b: number; c: number; d: number; e: number; f: number };
export type PaintGradientCommon = {
  stops: Array<{ offset: number; color: string }>;
  spreadMethod?: "pad" | "reflect" | "repeat";
  gradientUnits?: "objectBoundingBox" | "userSpaceOnUse";
  gradientTransform?: PaintTransform;
};
export type PaintFillGradient = {
  type: "linear-gradient" | "radial-gradient" | "conic-gradient";
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  angle?: number;
  from?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  fx?: number;
  fy?: number;
} & PaintGradientCommon;
export type PaintPatternContent =
  | { type: "rect"; x: number; y: number; width: number; height: number; fill: string; opacity?: number }
  | { type: "circle"; cx: number; cy: number; radius: number; fill: string; opacity?: number };
export type PaintFillPattern = {
  type: "pattern";
  x: number;
  y: number;
  width: number;
  height: number;
  patternUnits?: "objectBoundingBox" | "userSpaceOnUse";
  patternContentUnits?: "objectBoundingBox" | "userSpaceOnUse";
  transform?: PaintTransform;
  content: PaintPatternContent[];
};
export type PaintFill = PaintFillSolid | PaintFillGradient | PaintFillPattern;
export type Paint = PaintFill;

export type RenderMediaFit = "contain" | "cover" | "fill" | "none";
export type RenderNormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PathPoint = { x: number; y: number };
export type PathContour = {
  id: string;
  start: PathPoint;
  segments: Array<
    | { kind: "line"; to: PathPoint }
    | { kind: "quadratic"; control: PathPoint; to: PathPoint }
    | {
        kind: "cubic";
        control1: PathPoint;
        control2: PathPoint;
        to: PathPoint;
      }
    | {
        kind: "arc";
        radii: { x: number; y: number };
        rotation: number;
        largeArc: boolean;
        sweep: boolean;
        to: PathPoint;
      }
  >;
  closed: boolean;
};

/**
 * Local-plane triangles resolved by Runtime before GPU submission. Vertices are
 * packed XY pairs, indices address those pairs, and bounds are local units.
 */
export type PathMesh = {
  vertices: number[];
  indices: number[];
  bounds: { x: number; y: number; width: number; height: number };
};

/** Local-plane triangles for the basic closed-path stroke subtask. */
export type PathStrokeMesh = PathMesh;
export type PathStrokeJoin = "miter" | "bevel" | "round";
export type PathStrokeCap = "butt" | "square" | "round";
export type PathStrokeDash = { array: number[]; offset: number };

/** A positioned font-outline glyph, resolved by Runtime before GPU submission. */
export type PaintTextGlyph = {
  glyphId: number;
  cluster: number;
  x: number;
  y: number;
  width: number;
  height: number;
  path: string;
  pathScale: number;
  outline: { x: number; y: number; width: number; height: number };
};

export type PaintTextLine = {
  baselineY: number;
  advanceWidth: number;
};

export type RuntimeColorAdjustEffect = {
  id: string;
  type: "color-adjust";
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
};

export type RuntimeGrayscaleEffect = {
  id: string;
  type: "grayscale";
  amount: number;
};

export type RuntimeSepiaEffect = {
  id: string;
  type: "sepia";
  amount: number;
};

export type RuntimeInvertEffect = {
  id: string;
  type: "invert";
  amount: number;
};

export type RuntimeFilterOpacityEffect = {
  id: string;
  type: "filter-opacity";
  amount: number;
};

export type RuntimeBlurEffect = {
  id: string;
  type: "blur";
  radius: number;
};

export type RuntimeShadowEffect = {
  id: string;
  type: "shadow";
  source: "box" | "alpha";
  offset: { x: number; y: number };
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
};

export type RuntimeOuterGlowEffect = {
  id: string;
  type: "outer-glow";
  /** Gaussian sigma in projected composition/output pixels. */
  radius: number;
  color: string;
  opacity: number;
};

export type RuntimeInnerGlowEffect = {
  id: string;
  type: "inner-glow";
  /** Gaussian sigma in projected composition/output pixels. */
  radius: number;
  color: string;
  opacity: number;
};

export type RuntimeNoiseEffect = {
  id: string;
  type: "noise";
  scale: number;
  amount: number;
  opacity: number;
  seed: number;
};

export type RuntimeEffect =
  | RuntimeBlurEffect
  | RuntimeColorAdjustEffect
  | RuntimeGrayscaleEffect
  | RuntimeSepiaEffect
  | RuntimeInvertEffect
  | RuntimeFilterOpacityEffect
  | RuntimeShadowEffect
  | RuntimeOuterGlowEffect
  | RuntimeInnerGlowEffect
  | RuntimeNoiseEffect;
