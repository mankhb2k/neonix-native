import type { Matrix4 } from "../matrix4";
import type { PaintCommandBuffer } from "../paint";
import type {
  PaintFill,
  PathContour,
  PathMesh,
  PathStrokeCap,
  PathStrokeDash,
  PathStrokeJoin,
  PathStrokeMesh,
  RenderMediaFit,
  RenderNormalizedRect,
} from "../paint/paint-types";

export type RuntimeCompositionV2 = {
  width: number;
  height: number;
  fps: number;
  background?: string;
  graphId: string;
};

export type RuntimeViewV2 = {
  /** The only view value Runtime V2 exposes to painters: world space to clip space. */
  worldToClipMatrix: Matrix4;
};

export type RuntimeTimingV2 = {
  start: number;
  duration: number;
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
};

export type RuntimeImageV2 = {
  kind: "image";
  assetId: string;
  uri?: string;
  width: number;
  height: number;
  fit?: RenderMediaFit;
  crop?: RenderNormalizedRect;
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
};

export type RuntimeNodeV2 = {
  id: string;
  parentId: string | null;
  zIndex: number;
  timing: RuntimeTimingV2;
  opacity: number;
  visible: boolean;
  localMatrix: Matrix4;
  worldMatrix: Matrix4;
  content: RuntimeShapeV2 | RuntimePathV2 | RuntimeImageV2 | RuntimeVideoV2;
};

export type RuntimeProjectV2 = {
  format: "motion-runtime";
  formatVersion: 2;
  id: string;
  composition: RuntimeCompositionV2;
  view: RuntimeViewV2;
  nodes: RuntimeNodeV2[];
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
