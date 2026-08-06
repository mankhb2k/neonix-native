/**
 * Paint command op types — shared language between runtime and painters.
 */

import type { Matrix2D } from "../matrix";
import type { RuntimeEffect } from "../evaluator";
import type { PathContour } from "../geometry";
import type { PaintFill } from "../render-snapshot";

export type RenderDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  nodeId?: string;
  key?: string;
};

export type PaintCommand =
  | {
      op: "beginFrame";
      width: number;
      height: number;
      background?: string;
      sceneId: string;
      frame: number;
      time: number;
    }
  | { op: "endFrame" }
  | { op: "beginGroup"; key: string; nodeId: string }
  | { op: "endGroup"; key: string }
  /** Compositing scope (mask/isolation/offscreen) — draw nodes stay world-space. */
  | {
      op: "beginLayer";
      key: string;
      nodeId?: string;
      isolation?: boolean;
      offscreen?: boolean;
      mask?: {
        mode: "alpha" | "inverse-alpha" | "luma" | "inverse-luma" | "clip";
        sourceKey: string;
      };
    }
  | { op: "endLayer"; key: string }
  | {
      op: "setTransform";
      key: string;
      matrix: Matrix2D;
      alpha: number;
      visible: boolean;
      zIndex: number;
      blendMode?: "normal" | "multiply" | "screen" | "add" | "darken" | "lighten" | "overlay";
    }
  | {
      op: "drawText";
      key: string;
      nodeId: string;
      text: string;
      fontSize: number;
      fontWeight?: number;
      align?: "left" | "center" | "right";
      fill: string;
      fillPaint?: PaintFill;
      width: number;
      height: number;
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
        highlight?: { fill: string; paddingX?: number; paddingY?: number; radius?: number };
        sourceRef?: { kind: "text-run"; nodeId: string; runId: string };
      }>;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawShape";
      key: string;
      nodeId: string;
      shape: "rectangle" | "ellipse" | "polygon";
      fill: string;
      fillPaint?: PaintFill;
      width: number;
      height: number;
      cornerRadius?: number;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawSolid";
      key: string;
      nodeId: string;
      fill: string;
      width: number;
      height: number;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawImage";
      key: string;
      nodeId: string;
      assetId: string;
      uri?: string;
      width: number;
      height: number;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawPath";
      key: string;
      nodeId: string;
      contours: PathContour[];
      fillRule: "nonzero" | "evenodd";
      fill?: string;
      fillPaint?: PaintFill;
      stroke?: string;
      strokeWidth?: number;
      fillOpacity?: number;
      strokeOpacity?: number;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawVideo";
      key: string;
      nodeId: string;
      assetId: string;
      uri?: string;
      width: number;
      height: number;
      mediaTime: number;
      effects?: RuntimeEffect[];
    }
  | {
      op: "unsupported";
      key: string;
      nodeId: string;
      nodeType: string;
      message: string;
    };

export type PaintDrawCommand = Extract<
  PaintCommand,
  | { op: "drawText" }
  | { op: "drawShape" }
  | { op: "drawSolid" }
  | { op: "drawImage" }
  | { op: "drawPath" }
  | { op: "drawVideo" }
  | { op: "unsupported" }
>;

export function assertNeverPaintOp(command: never): never {
  throw new Error(
    `Unhandled paint command: ${JSON.stringify(command as { op?: string })}`,
  );
}
