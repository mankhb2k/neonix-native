/**
 * Static resource/geometry descriptor — separated from per-frame properties.
 *
 * Paint commands carry both immutable resource data (text runs, image URI,
 * path contours) and variable frame data (transform, alpha, fill).
 * This split enables:
 *  - Fingerprinting: only per-frame properties change in a structural patch.
 *  - Caching: resources survive frame boundaries without re-creation.
 *  - Painter optimization: skip resource re-upload when unchanged.
 *
 * §4 in core-engine-tasks.md, Task 4.1
 */

import type { PaintDrawCommand } from "./paint-command";
import type { RuntimeEffect } from "../evaluator";
import type { PathContour } from "../geometry";
import type { PaintFill } from "../render-snapshot";

// ── Resource descriptor (frame-invariant) ─────────────────────────────

export type PaintTextResource = {
  kind: "text";
  text: string;
  fontSize: number;
  fontWeight?: number;
  align?: "left" | "center" | "right";
  fontAssetId?: string;
  wrap?: "none" | "word" | "character";
  lineHeight?: number;
  letterSpacing?: number;
  maxLines?: number;
  overflow?: "visible" | "clip" | "ellipsis";
  runs?: Array<{
    id: string;
    text: string;
    fill?: string;
    fontAssetId?: string;
    fontWeight?: number;
    fontStyle?: "normal" | "italic";
    fontScale?: number;
    letterSpacing?: number;
    highlight?: {
      fill: string;
      paddingX?: number;
      paddingY?: number;
      radius?: number;
    };
  }>;
};

export type PaintShapeResource = {
  kind: "shape";
  shape: "rectangle" | "ellipse" | "polygon";
  cornerRadius?: number;
};

export type PaintImageResource = {
  kind: "image";
  assetId: string;
  uri?: string;
};

export type PaintVideoResource = {
  kind: "video";
  assetId: string;
  uri?: string;
};

export type PaintPathResource = {
  kind: "path";
  contours: PathContour[];
  fillRule: "nonzero" | "evenodd";
  fill?: string;
  fillPaint?: PaintFill;
  stroke?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
};

export type PaintResourceDescriptor =
  | PaintTextResource
  | PaintShapeResource
  | PaintImageResource
  | PaintVideoResource
  | PaintPathResource;

// ── Per-frame property (varies each frame) ────────────────────────────

export type PaintFrameProperty = {
  /** Width/height in world-space (may change e.g. text wrapping). */
  width: number;
  height: number;
  /** Optional dynamic fill override. */
  fill?: string;
  fillPaint?: PaintFill;
  /** Effects active this frame (may be keyframed). */
  effects?: RuntimeEffect[];
};

// ── Split helper ──────────────────────────────────────────────────────

export type SplitPaintCommand = {
  resource: PaintResourceDescriptor;
  frame: PaintFrameProperty;
  /** Original draw op for painters that prefer the full command. */
  original: PaintDrawCommand;
};

/**
 * Extract the frame-invariant resource descriptor from a draw command.
 * Returns null for unsupported/non-draw ops.
 */
export function extractPaintResource(
  cmd: PaintDrawCommand,
): PaintResourceDescriptor | null {
  switch (cmd.op) {
    case "drawText":
      return {
        kind: "text",
        text: cmd.text,
        fontSize: cmd.fontSize,
        fontWeight: cmd.fontWeight,
        align: cmd.align,
        fontAssetId: cmd.fontAssetId,
        wrap: cmd.wrap,
        lineHeight: cmd.lineHeight,
        letterSpacing: cmd.letterSpacing,
        maxLines: cmd.maxLines,
        overflow: cmd.overflow,
        runs: cmd.runs,
      };
    case "drawShape":
      return {
        kind: "shape",
        shape: cmd.shape,
        cornerRadius: cmd.cornerRadius,
      };
    case "drawImage":
      return {
        kind: "image",
        assetId: cmd.assetId,
        uri: cmd.uri,
      };
    case "drawVideo":
      return {
        kind: "video",
        assetId: cmd.assetId,
        uri: cmd.uri,
      };
    case "drawPath":
      return {
        kind: "path",
        contours: cmd.contours,
        fillRule: cmd.fillRule,
        fill: cmd.fill,
        fillPaint: cmd.fillPaint,
        stroke: cmd.stroke,
        strokeWidth: cmd.strokeWidth,
        fillOpacity: cmd.fillOpacity,
        strokeOpacity: cmd.strokeOpacity,
      };
    default:
      return null;
  }
}

/** Extract per-frame properties from a draw command. */
export function extractPaintFrameProperty(
  cmd: PaintDrawCommand,
): PaintFrameProperty {
  const base: PaintFrameProperty = {
    width: "width" in cmd ? (cmd as { width: number }).width : 0,
    height: "height" in cmd ? (cmd as { height: number }).height : 0,
  };
  if ("fill" in cmd) {
    base.fill = (cmd as { fill?: string }).fill;
  }
  if ("fillPaint" in cmd) {
    base.fillPaint = (cmd as { fillPaint?: PaintFill }).fillPaint;
  }
  if ("effects" in cmd) {
    base.effects = (cmd as { effects?: RuntimeEffect[] }).effects;
  }
  return base;
}

/** Split a draw command into static resource + frame properties. */
export function splitPaintCommand(cmd: PaintDrawCommand): SplitPaintCommand | null {
  const resource = extractPaintResource(cmd);
  if (!resource) return null;
  return {
    resource,
    frame: extractPaintFrameProperty(cmd),
    original: cmd,
  };
}
