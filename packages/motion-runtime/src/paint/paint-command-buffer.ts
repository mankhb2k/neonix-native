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

function parentKey(item: RenderSnapshotItem): string | null {
  return item.parentLayerId ?? null;
}

function pushBeginLayer(
  item: RenderSnapshotItem,
  commands: PaintCommand[],
): void {
  const c = item.compositing!;
  commands.push({
    op: "beginLayer",
    key: item.key,
    layerId: item.layerId,
    isolation: c.isolation === "isolate",
    offscreen: c.needsOffscreen,
    ...(c.mask
      ? {
          mask: {
            mode: c.mask.mode,
            sourceKey: `${item.graphId}:${c.mask.sourceLayerId}`,
            sourceVisibility: c.mask.sourceVisibility,
          },
        }
      : {}),
  });
}

function pushTransform(
  item: RenderSnapshotItem,
  commands: PaintCommand[],
): void {
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
}

function emitDraw(
  item: RenderSnapshotItem,
  commands: PaintCommand[],
  diagnostics: RenderDiagnostic[],
): void {
  const payload = item.payload;
  const effects = item.effects;

  if (payload.kind === "group") {
    commands.push({ op: "beginGroup", key: item.key, layerId: item.layerId });
    return;
  }

  if (payload.kind === "text") {
    commands.push({
      op: "drawText",
      key: item.key,
      layerId: item.layerId,
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
    return;
  }

  if (payload.kind === "shape") {
    commands.push({
      op: "drawShape",
      key: item.key,
      layerId: item.layerId,
      shape: payload.shape,
      fill: payload.fill ?? "#1877F2",
      ...(payload.fillPaint ? { fillPaint: payload.fillPaint } : {}),
      width: payload.width,
      height: payload.height,
      cornerRadius: payload.cornerRadius,
      ...(payload.points ? { points: payload.points } : {}),
      ...(payload.stroke ? { stroke: payload.stroke } : {}),
      ...(payload.strokeWidth != null
        ? { strokeWidth: payload.strokeWidth }
        : {}),
      ...(payload.strokeOpacity != null
        ? { strokeOpacity: payload.strokeOpacity }
        : {}),
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  if (payload.kind === "solid") {
    commands.push({
      op: "drawSolid",
      key: item.key,
      layerId: item.layerId,
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
        message: `Image ${item.layerId} has no resolved URI — placeholder`,
        layerId: item.layerId,
        key: item.key,
      });
    }
    commands.push({
      op: "drawImage",
      key: item.key,
      layerId: item.layerId,
      assetId: payload.assetId,
      uri: payload.uri,
      width: payload.width,
      height: payload.height,
      ...(payload.fit ? { fit: payload.fit } : {}),
      ...(payload.crop ? { crop: payload.crop } : {}),
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  if (payload.kind === "path") {
    if (!payload.contours.length) {
      diagnostics.push({
        severity: "warning",
        code: "path_empty",
        message: `Path ${item.layerId} has no contours`,
        layerId: item.layerId,
        key: item.key,
      });
    }
    commands.push({
      op: "drawPath",
      key: item.key,
      layerId: item.layerId,
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
      message: `Video ${item.layerId} uses placeholder until frame decode is wired`,
      layerId: item.layerId,
      key: item.key,
    });
    commands.push({
      op: "drawVideo",
      key: item.key,
      layerId: item.layerId,
      assetId: payload.assetId,
      uri: payload.uri,
      width: payload.width,
      height: payload.height,
      ...(payload.fit ? { fit: payload.fit } : {}),
      mediaTime: payload.mediaTime,
      ...(payload.mediaVisible === false
        ? { mediaVisible: false }
        : {}),
      ...(effects?.length ? { effects } : {}),
    });
    return;
  }

  diagnostics.push({
    severity: "error",
    code: "unsupported_payload",
    message: `Unsupported paint kind for ${item.layerId}`,
    layerId: item.layerId,
    key: item.key,
  });
  commands.push({
    op: "unsupported",
    key: item.key,
    layerId: item.layerId,
    nodeType: item.nodeType,
    message: `payload.kind=${payload.kind}`,
  });
}

function emitSubtree(
  parentId: string | null,
  byParent: Map<string | null, RenderSnapshotItem[]>,
  commands: PaintCommand[],
  diagnostics: RenderDiagnostic[],
): void {
  const children = byParent.get(parentId) ?? [];
  for (const item of children) {
    if (!item.visible) continue;
    const wrapLayer = itemNeedsLayer(item);
    if (wrapLayer) pushBeginLayer(item, commands);
    pushTransform(item, commands);
    emitDraw(item, commands, diagnostics);
    emitSubtree(item.layerId, byParent, commands, diagnostics);
    if (item.payload.kind === "group") {
      commands.push({ op: "endGroup", key: item.key });
    }
    if (wrapLayer) commands.push({ op: "endLayer", key: item.key });
  }
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
    graphId: snapshot.graphId,
    frame: snapshot.frame,
    time: snapshot.time,
    ...(perspectiveProjection ? { projection: perspectiveProjection } : {}),
  });

  const ordered = [...snapshot.items].sort(
    (a, b) => a.renderOrder - b.renderOrder || a.key.localeCompare(b.key),
  );

  const knownIds = new Set(ordered.map((item) => item.layerId));
  const byParent = new Map<string | null, RenderSnapshotItem[]>();
  for (const item of ordered) {
    if (
      !PAINT_KINDS.has(item.payload.kind) &&
      item.payload.kind !== "unknown"
    ) {
      diagnostics.push({
        severity: "error",
        code: "capability_not_in_ledger",
        message: `Payload kind "${item.payload.kind}" not in paint ledger`,
        layerId: item.layerId,
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
        layerId: item.layerId,
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
        layerId: item.layerId,
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
        layerId: item.layerId,
        nodeType: item.nodeType,
        message: `unknown nodeType=${item.nodeType}`,
      });
      continue;
    }
    const rawParent = parentKey(item);
    const parent = rawParent && knownIds.has(rawParent) ? rawParent : null;
    const list = byParent.get(parent) ?? [];
    list.push(item);
    byParent.set(parent, list);
  }

  emitSubtree(null, byParent, commands, diagnostics);

  commands.push({ op: "endFrame" });
  return { version: PAINT_COMMAND_VERSION, commands, diagnostics };
}
