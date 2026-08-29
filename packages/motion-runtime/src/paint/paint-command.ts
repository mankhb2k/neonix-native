/**
 * Paint command op types — shared language between runtime and painters.
 */

import type {
  PaintFill,
  PaintTextGlyph,
  PaintTextLine,
  PathContour,
  PathMesh,
  PathStrokeMesh,
  RenderMediaFit,
  RenderNormalizedRect,
} from "./paint-types";
import type { RuntimeEffectProgram } from "../visual/effect-program";

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
      /** Canonical V2 world-space to clip-space Matrix4. */
      projection: {
        worldToClipMatrix: number[];
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
      /** Apply once when an isolated subtree is composited back to its parent. */
      compositeAlpha?: number;
      /** Runtime-only ordered effect graph for this compositing scope. */
      effectProgram?: RuntimeEffectProgram;
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
      matrix4: number[];
      alpha: number;
      visible: boolean;
      order: number;
      blendMode?:
        | "normal"
        | "multiply"
        | "screen"
        | "add";
      /** 4×4 world matrix for perspective-3d projection (Phase 11). */
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
      /** Runtime-resolved glyph outlines. Native backends must not shape text. */
      glyphs?: PaintTextGlyph[];
      lines?: PaintTextLine[];
      verticalAlign?: "top" | "middle" | "bottom";
      direction?: "ltr" | "rtl";
      language?: string;
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
    }
  | {
      op: "drawSolid";
      key: string;
      layerId: string;
      fill: string;
      width: number;
      height: number;
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
    }
  | {
      op: "drawPath";
      key: string;
      layerId: string;
      contours: PathContour[];
      /** Runtime-resolved local-plane mesh. GPU backends must not tessellate contours. */
      mesh?: PathMesh;
      strokeMesh?: PathStrokeMesh;
      fillRule: "nonzero" | "evenodd";
      fill?: string;
      fillPaint?: PaintFill;
      stroke?: string;
      strokeWidth?: number;
      fillOpacity?: number;
      strokeOpacity?: number;
      strokeJoin?: "miter" | "bevel" | "round";
      strokeCap?: "butt" | "square" | "round";
      strokeDash?: { array: number[]; offset: number };
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
      muted?: boolean;
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
