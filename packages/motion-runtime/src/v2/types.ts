import type { Matrix2D } from "../matrix";
import type { Matrix4 } from "../matrix4";
import type { PaintCommandBuffer } from "../paint";
import type { PaintFill } from "../render-snapshot";

export type RuntimeCompositionV2 = {
  width: number;
  height: number;
  fps: number;
  background?: string;
  graphId: string;
};

export type RuntimeViewV2 = {
  viewMatrix: Matrix4;
  projectionMatrix: Matrix4;
  viewProjectionMatrix: Matrix4;
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

export type RuntimeNodeV2 = {
  id: string;
  parentId: string | null;
  zIndex: number;
  timing: RuntimeTimingV2;
  opacity: number;
  visible: boolean;
  localMatrix: Matrix4;
  worldMatrix: Matrix4;
  matrix2D: Matrix2D;
  content: RuntimeShapeV2;
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
