/**
 * Shared paint command buffer — Pixi and worker consume the same ops.
 * Wave-2: path, gradient fills, video placeholder, filters, blend.
 */

import type { Matrix2D } from "./matrix";
import type { RuntimeEffect } from "./evaluator";
import type { PathContour } from "./geometry";
import type {
  PaintFill,
  RenderSnapshot,
  RenderSnapshotItem,
} from "./render-snapshot";

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
  | {
      op: "setTransform";
      key: string;
      matrix: Matrix2D;
      alpha: number;
      visible: boolean;
      zIndex: number;
      blendMode?: "normal" | "multiply" | "screen" | "add";
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

export type PaintCommandBuffer = {
  commands: PaintCommand[];
  diagnostics: RenderDiagnostic[];
};

const PAINT_KINDS = new Set([
  "group",
  "text",
  "shape",
  "solid",
  "image",
  "path",
  "video",
]);

function emitItem(
  item: RenderSnapshotItem,
  commands: PaintCommand[],
  diagnostics: RenderDiagnostic[],
): void {
  if (!item.visible) return;

  commands.push({
    op: "setTransform",
    key: item.key,
    matrix: item.worldMatrix,
    alpha: item.worldOpacity,
    visible: item.visible,
    zIndex: item.renderOrder,
    ...(item.blendMode ? { blendMode: item.blendMode } : {}),
  });

  const payload = item.payload;
  const effects = item.effects;

  if (payload.kind === "group") {
    commands.push({ op: "beginGroup", key: item.key, nodeId: item.nodeId });
    commands.push({ op: "endGroup", key: item.key });
    return;
  }

  if (payload.kind === "text") {
    commands.push({
      op: "drawText",
      key: item.key,
      nodeId: item.nodeId,
      text: payload.text,
      fontSize: payload.fontSize,
      fontWeight: payload.fontWeight,
      align: payload.align,
      fill: payload.fill ?? "#0f1419",
      ...(payload.fillPaint ? { fillPaint: payload.fillPaint } : {}),
      width: item.worldBounds.width,
      height: item.worldBounds.height,
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  if (payload.kind === "shape") {
    commands.push({
      op: "drawShape",
      key: item.key,
      nodeId: item.nodeId,
      shape: payload.shape,
      fill: payload.fill ?? "#1877F2",
      ...(payload.fillPaint ? { fillPaint: payload.fillPaint } : {}),
      width: payload.width,
      height: payload.height,
      cornerRadius: payload.cornerRadius,
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  if (payload.kind === "solid") {
    commands.push({
      op: "drawSolid",
      key: item.key,
      nodeId: item.nodeId,
      fill: payload.fill ?? "#1a1916",
      width: payload.width,
      height: payload.height,
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  if (payload.kind === "image") {
    if (!payload.uri) {
      diagnostics.push({
        severity: "warning",
        code: "asset_uri_missing",
        message: `Image ${item.nodeId} has no resolved URI — placeholder`,
        nodeId: item.nodeId,
        key: item.key,
      });
    }
    commands.push({
      op: "drawImage",
      key: item.key,
      nodeId: item.nodeId,
      assetId: payload.assetId,
      uri: payload.uri,
      width: payload.width,
      height: payload.height,
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  if (payload.kind === "path") {
    if (!payload.contours.length) {
      diagnostics.push({
        severity: "warning",
        code: "path_empty",
        message: `Path ${item.nodeId} has no contours`,
        nodeId: item.nodeId,
        key: item.key,
      });
    }
    commands.push({
      op: "drawPath",
      key: item.key,
      nodeId: item.nodeId,
      contours: payload.contours,
      fillRule: payload.fillRule,
      fill: payload.fill,
      ...(payload.fillPaint ? { fillPaint: payload.fillPaint } : {}),
      stroke: payload.stroke,
      strokeWidth: payload.strokeWidth,
      fillOpacity: payload.fillOpacity,
      strokeOpacity: payload.strokeOpacity,
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  if (payload.kind === "video") {
    diagnostics.push({
      severity: "info",
      code: "video_preview_placeholder",
      message: `Video ${item.nodeId} uses placeholder until frame decode is wired`,
      nodeId: item.nodeId,
      key: item.key,
    });
    commands.push({
      op: "drawVideo",
      key: item.key,
      nodeId: item.nodeId,
      assetId: payload.assetId,
      uri: payload.uri,
      width: payload.width,
      height: payload.height,
      mediaTime: payload.mediaTime,
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  diagnostics.push({
    severity: "error",
    code: "unsupported_payload",
    message: `Unsupported paint kind for ${item.nodeId}`,
    nodeId: item.nodeId,
    key: item.key,
  });
  commands.push({
    op: "unsupported",
    key: item.key,
    nodeId: item.nodeId,
    nodeType: item.nodeType,
    message: `payload.kind=${payload.kind}`,
  });
}

/**
 * Convert interaction snapshot → ordered paint commands.
 * Unknown kinds emit diagnostics — never silently skipped.
 */
export function buildPaintCommandBuffer(
  snapshot: RenderSnapshot,
): PaintCommandBuffer {
  const commands: PaintCommand[] = [];
  const diagnostics: RenderDiagnostic[] = [];

  commands.push({
    op: "beginFrame",
    width: snapshot.width,
    height: snapshot.height,
    background: snapshot.background,
    sceneId: snapshot.sceneId,
    frame: snapshot.frame,
    time: snapshot.time,
  });

  const ordered = [...snapshot.items].sort(
    (a, b) => a.renderOrder - b.renderOrder || a.key.localeCompare(b.key),
  );

  for (const item of ordered) {
    if (!PAINT_KINDS.has(item.payload.kind) && item.payload.kind !== "unknown") {
      diagnostics.push({
        severity: "error",
        code: "capability_not_in_ledger",
        message: `Payload kind "${item.payload.kind}" not in paint ledger`,
        nodeId: item.nodeId,
        key: item.key,
      });
      commands.push({
        op: "unsupported",
        key: item.key,
        nodeId: item.nodeId,
        nodeType: item.nodeType,
        message: `kind=${item.payload.kind}`,
      });
      continue;
    }
    if (item.payload.kind === "unknown") {
      diagnostics.push({
        severity: "error",
        code: "unsupported_node_type",
        message: `Node type "${item.nodeType}" has no painter`,
        nodeId: item.nodeId,
        key: item.key,
      });
      commands.push({
        op: "unsupported",
        key: item.key,
        nodeId: item.nodeId,
        nodeType: item.nodeType,
        message: `unknown nodeType=${item.nodeType}`,
      });
      continue;
    }
    emitItem(item, commands, diagnostics);
  }

  commands.push({ op: "endFrame" });
  return { commands, diagnostics };
}
