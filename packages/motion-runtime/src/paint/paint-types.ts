/** Backend-neutral paint data owned by the V2 runtime contract. */

export type PaintFillSolid = { type: "solid"; color: string };
export type PaintFillGradient = {
  type: "linear-gradient" | "radial-gradient";
  angle?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  stops: Array<{ offset: number; color: string }>;
};
export type PaintFill = PaintFillSolid | PaintFillGradient;

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
    | {
        kind: "cubic";
        control1: PathPoint;
        control2: PathPoint;
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

export type RuntimeBlurEffect = {
  id: string;
  type: "blur";
  radius: number;
};

export type RuntimeDropShadowEffect = {
  id: string;
  type: "drop-shadow";
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
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
  | RuntimeDropShadowEffect
  | RuntimeOuterGlowEffect
  | RuntimeInnerGlowEffect
  | RuntimeNoiseEffect;
