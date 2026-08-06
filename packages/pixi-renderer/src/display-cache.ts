/**
 * Pure display-cache sync from PaintCommandBuffer — unit-testable without WebGL.
 */

import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";

export type CachedDisplayDesc = {
  key: string;
  kind: "group" | "text" | "graphics" | "sprite" | "path" | "video" | "unsupported";
  /** Full affine components (a b c d e f) — no hypot-only decompose. */
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number };
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  alpha: number;
  visible: boolean;
  zIndex: number;
  label?: string;
  fill?: string;
  width?: number;
  height?: number;
  stroke?: string;
};

export type DisplayCacheStats = {
  created: number;
  updated: number;
  removed: number;
};

/** Decompose affine including skew (matches Pixi Matrix.decompose intent). */
function decompose(
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
) {
  const a = matrix.a;
  const b = matrix.b;
  const c = matrix.c;
  const d = matrix.d;
  const rotation = Math.atan2(b, a);
  const denom = a * a + b * b;
  const scaleX = Math.sqrt(denom) || 1;
  const scaleY = (a * d - c * b) / scaleX;
  const skewX = Math.atan2(a * c + b * d, denom);
  return {
    matrix: { ...matrix },
    x: matrix.e,
    y: matrix.f,
    rotation,
    scaleX,
    scaleY,
    skewX,
    skewY: 0,
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
    if (cmd.op === "beginLayer" || cmd.op === "endLayer") continue;
    if (cmd.op === "setTransform") {
      pending = cmd;
      continue;
    }

    const xf = pending?.key === cmd.key ? pending : null;
    if (pending?.key === cmd.key) pending = null;
    const decomp = xf
      ? decompose(xf.matrix)
      : {
          matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          x: 0,
          y: 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          skewX: 0,
          skewY: 0,
        };
    const base = {
      matrix: decomp.matrix,
      x: decomp.x,
      y: decomp.y,
      rotation: decomp.rotation,
      scaleX: decomp.scaleX,
      scaleY: decomp.scaleY,
      skewX: decomp.skewX,
      skewY: decomp.skewY,
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
      continue;
    }
    if (cmd.op === "drawPath") {
      upsert({
        key: cmd.key,
        kind: "path",
        ...base,
        fill: cmd.fill,
        stroke: cmd.stroke,
      });
      continue;
    }
    if (cmd.op === "drawVideo") {
      upsert({
        key: cmd.key,
        kind: "video",
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
