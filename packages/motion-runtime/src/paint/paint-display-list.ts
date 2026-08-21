/**
 * Neutral display list decoded from PaintCommandBuffer.
 * Ephemeral per-frame structure — not a second JSON schema.
 */

import type { RuntimeEffect } from "./paint-types";
import type { PaintDrawCommand, RenderDiagnostic } from "./paint-command";
import type { PAINT_COMMAND_VERSION } from "./paint-buffer";

export type PaintTransformState = {
  key: string;
  matrix4: number[];
  alpha: number;
  visible: boolean;
  zIndex: number;
  blendMode?: "normal" | "multiply" | "screen" | "add" | "darken" | "lighten" | "overlay";
};

export type PaintLayerScope = {
  kind: "layer";
  key: string;
  layerId?: string;
  isolation: boolean;
  offscreen: boolean;
  mask?: {
    mode: "alpha" | "inverse-alpha" | "luma" | "inverse-luma" | "clip";
    sourceKey: string;
    sourceVisibility?: "mask-only" | "content-and-mask";
  };
  children: PaintDisplayNode[];
};

export type PaintGroupScope = {
  kind: "group";
  key: string;
  layerId: string;
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
  graphId: string;
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
export type { PaintFill, PathContour } from "./paint-types";
