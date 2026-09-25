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
import type {
  PaintFill,
  PathContour,
  RenderImagePreserveAspectRatio,
  RenderImageRendering,
  RenderMediaFit,
} from "./paint-types";

// ── Resource descriptor (frame-invariant) ─────────────────────────────

export type PaintTextResource = {
  kind: "text";
  text: string;
  fontSize: number;
  fontWeight?: number;
  align?: "left" | "center" | "right";
  fontAssetId?: string;
  wrap?: "none" | "word" | "character" | "word-break-long";
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
  points?: Array<{ x: number; y: number }>;
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
  strokeMesh?: import("./paint-types").PathStrokeMesh;
  stroke?: string;
  strokePaint?: PaintFill;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeMiterLimit?: number;
  strokeJoin?: "miter" | "bevel" | "round";
  strokeCap?: "butt" | "square" | "round";
  strokeDash?: { array: number[]; offset: number };
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
  x?: number;
  y?: number;
  /** Optional dynamic fill override. */
  fill?: string;
  fillPaint?: PaintFill;
  fit?: RenderMediaFit;
  preserveAspectRatio?: RenderImagePreserveAspectRatio;
  imageRendering?: RenderImageRendering;
  mediaTime?: number;
  mediaVisible?: boolean;
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
        points: cmd.points,
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
        strokeMesh: cmd.strokeMesh,
        stroke: cmd.stroke,
        strokePaint: cmd.strokePaint,
        strokeWidth: cmd.strokeWidth,
        fillOpacity: cmd.fillOpacity,
        strokeOpacity: cmd.strokeOpacity,
        strokeMiterLimit: cmd.strokeMiterLimit,
        strokeJoin: cmd.strokeJoin,
        strokeCap: cmd.strokeCap,
        strokeDash: cmd.strokeDash,
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
  if ("fit" in cmd) {
    base.fit = (cmd as { fit?: RenderMediaFit }).fit;
  }
  if (cmd.op === "drawImage") {
    base.x = cmd.x;
    base.y = cmd.y;
    base.fit = cmd.fit;
    base.preserveAspectRatio = cmd.preserveAspectRatio;
    base.imageRendering = cmd.imageRendering;
  }
  if ("mediaTime" in cmd) {
    base.mediaTime = (cmd as { mediaTime?: number }).mediaTime;
  }
  if ("mediaVisible" in cmd) {
    base.mediaVisible = (cmd as { mediaVisible?: boolean }).mediaVisible;
  }
  return base;
}

/** Split a draw command into static resource + frame properties. */
export function splitPaintCommand(
  cmd: PaintDrawCommand,
): SplitPaintCommand | null {
  const resource = extractPaintResource(cmd);
  if (!resource) return null;
  return {
    resource,
    frame: extractPaintFrameProperty(cmd),
    original: cmd,
  };
}
