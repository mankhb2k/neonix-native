/**
 * Neutral display list decoded from PaintCommandBuffer.
 * Ephemeral per-frame structure — not a second JSON schema.
 */

import type { Matrix2D } from "../matrix";
import type { RuntimeEffect } from "../evaluator";
import type { PathContour } from "../geometry";
import type { PaintFill } from "../render-snapshot";
import type { PaintDrawCommand, RenderDiagnostic } from "./paint-command";
import type { PAINT_COMMAND_VERSION } from "./paint-command-buffer";

export type PaintTransformState = {
  key: string;
  matrix: Matrix2D;
  alpha: number;
  visible: boolean;
  zIndex: number;
  blendMode?: "normal" | "multiply" | "screen" | "add";
};

export type PaintLayerScope = {
  kind: "layer";
  key: string;
  nodeId?: string;
  isolation: boolean;
  offscreen: boolean;
  mask?: {
    mode: "alpha" | "inverse-alpha" | "luma" | "inverse-luma" | "clip";
    sourceKey: string;
  };
  children: PaintDisplayNode[];
};

export type PaintGroupScope = {
  kind: "group";
  key: string;
  nodeId: string;
  transform?: PaintTransformState;
  children: PaintDisplayNode[];
};

export type PaintDrawable = {
  kind: "drawable";
  key: string;
  transform: PaintTransformState;
  draw: PaintDrawCommand;
  effects?: RuntimeEffect[];
};

export type PaintDisplayNode = PaintLayerScope | PaintGroupScope | PaintDrawable;

export type PaintDisplayList = {
  version: typeof PAINT_COMMAND_VERSION;
  width: number;
  height: number;
  background?: string;
  sceneId: string;
  frame: number;
  time: number;
  roots: PaintDisplayNode[];
  diagnostics: RenderDiagnostic[];
};

export type PaintValidateIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  key?: string;
};

export type PaintValidateResult =
  | { ok: true; issues: PaintValidateIssue[] }
  | { ok: false; issues: PaintValidateIssue[] };

/** Contours / fills referenced only for type re-exports in painters. */
export type { PathContour, PaintFill };
