/**
 * Pure display-cache sync from PaintCommandBuffer — unit-testable without WebGL.
 */

import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";

export type CachedDisplayDesc = {
  key: string;
  kind: "group" | "text" | "graphics" | "sprite" | "unsupported";
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  visible: boolean;
  zIndex: number;
  label?: string;
  fill?: string;
  width?: number;
  height?: number;
};

export type DisplayCacheStats = {
  created: number;
  updated: number;
  removed: number;
};

function decompose(
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
) {
  return {
    x: matrix.e,
    y: matrix.f,
    rotation: Math.atan2(matrix.b, matrix.a),
    scaleX: Math.hypot(matrix.a, matrix.b) || 1,
    scaleY: Math.hypot(matrix.c, matrix.d) || 1,
  };
}

/** Sync paint buffer into a Map cache (mirrors Pixi create/update/remove). */
export function syncPaintBufferToCache(
  cache: Map<string, CachedDisplayDesc>,
  buffer: PaintCommandBuffer,
): DisplayCacheStats {
  let created = 0;
  let updated = 0;
  const live = new Set<string>();
  let pending: Extract<PaintCommand, { op: "setTransform" }> | null = null;

  const upsert = (desc: CachedDisplayDesc) => {
    live.add(desc.key);
    if (cache.has(desc.key)) {
      cache.set(desc.key, desc);
      updated += 1;
    } else {
      cache.set(desc.key, desc);
      created += 1;
    }
  };

  for (const cmd of buffer.commands) {
    if (cmd.op === "beginFrame" || cmd.op === "endFrame") continue;
    if (cmd.op === "setTransform") {
      pending = cmd;
      continue;
    }

    const xf = pending?.key === cmd.key ? pending : null;
    if (pending?.key === cmd.key) pending = null;
    const decomp = xf ? decompose(xf.matrix) : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    const base = {
      x: decomp.x,
      y: decomp.y,
      rotation: decomp.rotation,
      scaleX: decomp.scaleX,
      scaleY: decomp.scaleY,
      alpha: xf?.alpha ?? 1,
      visible: xf?.visible ?? true,
      zIndex: xf?.zIndex ?? 0,
    };

    if (cmd.op === "beginGroup" || cmd.op === "endGroup") {
      if (cmd.op === "beginGroup") {
        upsert({ key: cmd.key, kind: "group", ...base });
      }
      continue;
    }
    if (cmd.op === "unsupported") {
      upsert({ key: cmd.key, kind: "unsupported", ...base });
      continue;
    }
    if (cmd.op === "drawText") {
      upsert({
        key: cmd.key,
        kind: "text",
        ...base,
        label: cmd.text,
        fill: cmd.fill,
        width: cmd.width,
        height: cmd.height,
      });
      continue;
    }
    if (cmd.op === "drawShape" || cmd.op === "drawSolid") {
      upsert({
        key: cmd.key,
        kind: "graphics",
        ...base,
        fill: cmd.fill,
        width: cmd.width,
        height: cmd.height,
      });
      continue;
    }
    if (cmd.op === "drawImage") {
      upsert({
        key: cmd.key,
        kind: "sprite",
        ...base,
        width: cmd.width,
        height: cmd.height,
        label: cmd.uri ?? cmd.assetId,
      });
    }
  }

  let removed = 0;
  for (const key of [...cache.keys()]) {
    if (live.has(key)) continue;
    cache.delete(key);
    removed += 1;
  }

  return { created, updated, removed };
}
