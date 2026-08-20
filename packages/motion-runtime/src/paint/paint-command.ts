/**
 * Paint command op types — shared language between runtime and painters.
 */

import type { Matrix2D } from "../matrix";
import type { RuntimeEffect } from "../evaluator";
import type { PathContour } from "../geometry";
import type {
  PaintFill,
  RenderMediaFit,
  RenderNormalizedRect,
} from "../render-snapshot";

export type RenderDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  layerId?: string;
  key?: string;
};

export type PaintCommand =
  | {
      op: "beginFrame";
      width: number;
      height: number;
      background?: string;
      graphId: string;
      frame: number;
      time: number;
      /** Perspective 3D projection (Phase 11). When present, painters should use matrix4. */
      projection?: {
        viewMatrix: number[];
        projectionMatrix: number[];
        viewProjectionMatrix?: number[];
      };
    }
  | { op: "endFrame" }
  | { op: "beginGroup"; key: string; layerId: string }
  | { op: "endGroup"; key: string }
  /** Compositing scope (mask/isolation/offscreen) — draw layers stay world-space. */
  | {
      op: "beginLayer";
      key: string;
      layerId?: string;
      isolation?: boolean;
      offscreen?: boolean;
      mask?: {
        mode: "alpha" | "inverse-alpha" | "luma" | "inverse-luma" | "clip";
        sourceKey: string;
        sourceVisibility?: "mask-only" | "content-and-mask";
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
      blendMode?:
        | "normal"
        | "multiply"
        | "screen"
        | "add"
        | "darken"
        | "lighten"
        | "overlay";
      /** 4×4 world matrix for perspective-3d projection (Phase 11). */
      matrix4?: number[];
    }
  | {
      op: "drawText";
      key: string;
      layerId: string;
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
        highlight?: {
          fill: string;
          paddingX?: number;
          paddingY?: number;
          radius?: number;
        };
        sourceRef?: { kind: "text-run"; layerId: string; runId: string };
      }>;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawShape";
      key: string;
      layerId: string;
      shape: "rectangle" | "ellipse" | "polygon";
      fill: string;
      fillPaint?: PaintFill;
      width: number;
      height: number;
      fillOpacity?: number;
      cornerRadius?: number;
      points?: Array<{ x: number; y: number }>;
      stroke?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawSolid";
      key: string;
      layerId: string;
      fill: string;
      width: number;
      height: number;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawImage";
      key: string;
      layerId: string;
      assetId: string;
      uri?: string;
      width: number;
      height: number;
      fit?: RenderMediaFit;
      crop?: RenderNormalizedRect;
      effects?: RuntimeEffect[];
    }
  | {
      op: "drawPath";
      key: string;
      layerId: string;
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
      layerId: string;
      assetId: string;
      uri?: string;
      width: number;
      height: number;
      fit?: RenderMediaFit;
      mediaTime: number;
      mediaVisible?: boolean;
      effects?: RuntimeEffect[];
    }
  | {
      op: "unsupported";
      key: string;
      layerId: string;
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
