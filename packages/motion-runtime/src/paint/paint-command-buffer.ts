/**
 * PaintCommandBuffer builder — snapshot → ordered commands.
 */

import type { RenderSnapshot, RenderSnapshotItem } from "../render-snapshot";
import type { PaintCommand, RenderDiagnostic } from "./paint-command";

/** Bump when paint op semantics or required fields change. */
export const PAINT_COMMAND_VERSION = 1 as const;

export type PaintCommandBuffer = {
  /** Defaults to {@link PAINT_COMMAND_VERSION} when omitted (legacy buffers). */
  version?: typeof PAINT_COMMAND_VERSION;
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

function itemNeedsLayer(item: RenderSnapshotItem): boolean {
  const c = item.compositing;
  if (!c) return false;
  return (
    c.needsOffscreen ||
    c.isolation === "isolate" ||
    c.isAdjustment ||
    Boolean(c.mask) ||
    c.groupCompositing === "isolate" ||
    (c.effectOrder?.length ?? 0) > 0
  );
}

function pushBeginLayer(
  item: RenderSnapshotItem,
  commands: PaintCommand[],
): void {
  const c = item.compositing!;
  commands.push({
    op: "beginLayer",
    key: item.key,
    nodeId: item.nodeId,
    isolation: c.isolation === "isolate",
    offscreen: c.needsOffscreen,
    ...(c.mask
      ? {
          mask: {
            mode: c.mask.mode,
            sourceKey: `${item.sceneId}:${c.mask.sourceNodeId}`,
          },
        }
      : {}),
  });
}

function emitItem(
  item: RenderSnapshotItem,
  commands: PaintCommand[],
  diagnostics: RenderDiagnostic[],
): void {
  if (!item.visible) return;

  const wrapLayer = itemNeedsLayer(item);
  if (wrapLayer) pushBeginLayer(item, commands);

  commands.push({
    op: "setTransform",
    key: item.key,
    matrix: item.worldMatrix,
    alpha: item.worldOpacity,
    visible: item.visible,
    zIndex: item.renderOrder,
    ...(item.blendMode ? { blendMode: item.blendMode } : {}),
    ...(item.worldMatrix4 ? { matrix4: Array.from(item.worldMatrix4) } : {}),
  });

  const payload = item.payload;
  const effects = item.effects;

  if (payload.kind === "group") {
    commands.push({ op: "beginGroup", key: item.key, nodeId: item.nodeId });
    commands.push({ op: "endGroup", key: item.key });
    if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
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
      ...(payload.fontAssetId ? { fontAssetId: payload.fontAssetId } : {}),
      ...(payload.wrap ? { wrap: payload.wrap } : {}),
      ...(payload.lineHeight != null ? { lineHeight: payload.lineHeight } : {}),
      ...(payload.letterSpacing != null
        ? { letterSpacing: payload.letterSpacing }
        : {}),
      ...(payload.maxLines != null ? { maxLines: payload.maxLines } : {}),
      ...(payload.overflow ? { overflow: payload.overflow } : {}),
      ...(payload.runs ? { runs: payload.runs } : {}),
      ...(effects?.length ? { effects } : {}),
    });
    if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
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
    if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
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
    if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
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
    if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
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
    if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
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
    if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
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
  if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
}

/**
 * Convert interaction snapshot → ordered paint commands.
 * Unknown kinds emit diagnostics — never silently skipped.
 */
export function buildPaintCommandBuffer(
  snapshot: RenderSnapshot,
  perspectiveProjection?: { viewMatrix: number[]; projectionMatrix: number[] },
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
    ...(perspectiveProjection ? { projection: perspectiveProjection } : {}),
  });

  const ordered = [...snapshot.items].sort(
    (a, b) => a.renderOrder - b.renderOrder || a.key.localeCompare(b.key),
  );

  for (const item of ordered) {
    if (
      !PAINT_KINDS.has(item.payload.kind) &&
      item.payload.kind !== "unknown"
    ) {
      diagnostics.push({
        severity: "error",
        code: "capability_not_in_ledger",
        message: `Payload kind "${item.payload.kind}" not in paint ledger`,
        nodeId: item.nodeId,
        key: item.key,
      });
      commands.push({
        op: "setTransform",
        key: item.key,
        matrix: item.worldMatrix,
        alpha: item.worldOpacity,
        visible: item.visible,
        zIndex: item.renderOrder,
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
        op: "setTransform",
        key: item.key,
        matrix: item.worldMatrix,
        alpha: item.worldOpacity,
        visible: item.visible,
        zIndex: item.renderOrder,
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
  return { version: PAINT_COMMAND_VERSION, commands, diagnostics };
}
