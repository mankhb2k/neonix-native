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

export type PaintOrderItem = "fill" | "stroke" | "markers";
export type PaintOrder = PaintOrderItem[];

export type PaintFillNone = { type: "none" };
export type PaintFillSolid = { type: "solid"; color: string; opacity?: number };
export type PaintTransform = { a: number; b: number; c: number; d: number; e: number; f: number };
export type PaintGradientCommon = {
  stops: Array<{ offset: number; color: string; stopOpacity?: number }>;
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
  radiusX?: number;
  radiusY?: number;
  fx?: number;
  fy?: number;
  fr?: number;
} & PaintGradientCommon;
export type PaintPatternViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  align?: string;
  meetOrSlice?: "meet" | "slice";
};
export type PaintPatternStyle = {
  fill?: PaintFill;
  fillOpacity?: number;
  stroke?: PaintFill;
  strokeWidth?: number;
  strokeOpacity?: number;
};
export type PaintPatternContent =
  | ({ type: "rect"; x: number; y: number; width: number; height: number; rx?: number; ry?: number } & PaintPatternStyle)
  | ({ type: "circle"; cx: number; cy: number; radius: number } & PaintPatternStyle)
  | ({ type: "ellipse"; cx: number; cy: number; rx: number; ry: number } & PaintPatternStyle)
  | ({ type: "line"; x1: number; y1: number; x2: number; y2: number } & PaintPatternStyle)
  | ({ type: "polyline" | "polygon"; points: Array<{ x: number; y: number }> } & PaintPatternStyle)
  | ({ type: "path"; contours: PathContour[]; fillRule?: "nonzero" | "evenodd" } & PaintPatternStyle)
  | { type: "group"; transform?: PaintTransform; opacity?: number; children: PaintPatternContent[] };
export type PaintFillPattern = {
  type: "pattern";
  x: number;
  y: number;
  width: number;
  height: number;
  patternUnits?: "objectBoundingBox" | "userSpaceOnUse";
  patternContentUnits?: "objectBoundingBox" | "userSpaceOnUse";
  patternTransform?: PaintTransform;
  transform?: PaintTransform;
  viewBox?: PaintPatternViewBox;
  content: PaintPatternContent[];
};
export type PaintFill = PaintFillNone | PaintFillSolid | PaintFillGradient | PaintFillPattern;
export type Paint = PaintFill;

export type RenderMediaFit = "contain" | "cover" | "fill" | "none";
export type RenderImageAlign =
  | "none"
  | "xMinYMin"
  | "xMidYMin"
  | "xMaxYMin"
  | "xMinYMid"
  | "xMidYMid"
  | "xMaxYMid"
  | "xMinYMax"
  | "xMidYMax"
  | "xMaxYMax";
export type RenderImagePreserveAspectRatio = {
  defer?: boolean;
  align?: RenderImageAlign;
  meetOrSlice?: "meet" | "slice";
};
export type RenderImageRendering =
  | "auto"
  | "optimizeQuality"
  | "optimizeSpeed"
  | "smooth"
  | "high-quality"
  | "crisp-edges"
  | "pixelated";
/** Normalized texture coordinates used by backend-neutral preview layouts. */
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

/** One SVG marker instance positioned on a lowered path. */
export type PathMarker = {
  id: string;
  placement: "start" | "mid" | "end";
  contours: PathContour[];
  mesh?: PathMesh;
  strokeMesh?: PathStrokeMesh;
  fill?: string;
  fillPaint?: PaintFill;
  fillOpacity?: number;
  stroke?: string;
  strokePaint?: PaintFill;
  strokeWidth?: number;
  strokeOpacity?: number;
  paintOrder: PaintOrder;
};

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
