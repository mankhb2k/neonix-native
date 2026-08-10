/**
 * Pixi snapshot adapter (R8) — syncs RenderSnapshot items into a display-object cache.
 * GPU backend is optional; sync logic is deterministic and unit-testable without WebGL.
 */

import type {
  RenderSnapshot,
  RenderSnapshotItem,
} from "@motionvideo/motion-runtime";

export type DisplayObjectLike = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  visible: boolean;
  width: number;
  height: number;
  zIndex: number;
  kind: RenderSnapshotItem["payload"]["kind"];
};

export type PixiSyncStats = {
  created: number;
  updated: number;
  removed: number;
  frameTimeMs: number;
};

/** Stable ID → display object cache. */
export class PixiSnapshotAdapter {
  private readonly cache = new Map<string, DisplayObjectLike>();

  get objects(): readonly DisplayObjectLike[] {
    return [...this.cache.values()].sort(
      (a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id),
    );
  }

  clear(): void {
    this.cache.clear();
  }

  /** Sync snapshot into cache. Selection/hit-test remain editor-overlay owned. */
  sync(snapshot: RenderSnapshot): PixiSyncStats {
    const started = performance.now();
    let created = 0;
    let updated = 0;
    const seen = new Set<string>();

    for (const item of snapshot.items) {
      if (!item.visible) continue;
      seen.add(item.key);
      const next = itemToDisplay(item);
      if (!this.cache.has(item.key)) {
        this.cache.set(item.key, next);
        created += 1;
      } else {
        this.cache.set(item.key, next);
        updated += 1;
      }
    }

    let removed = 0;
    for (const key of [...this.cache.keys()]) {
      if (!seen.has(key)) {
        this.cache.delete(key);
        removed += 1;
      }
    }

    return {
      created,
      updated,
      removed,
      frameTimeMs: performance.now() - started,
    };
  }
}

function itemToDisplay(item: RenderSnapshotItem): DisplayObjectLike {
  const width =
    "width" in item.payload && typeof item.payload.width === "number"
      ? item.payload.width
      : item.worldBounds.width;
  const height =
    "height" in item.payload && typeof item.payload.height === "number"
      ? item.payload.height
      : item.worldBounds.height;
  return {
    id: item.key,
    x: item.worldMatrix.e,
    y: item.worldMatrix.f,
    rotation: Math.atan2(item.worldMatrix.b, item.worldMatrix.a),
    scaleX: Math.hypot(item.worldMatrix.a, item.worldMatrix.b) || 1,
    scaleY: Math.hypot(item.worldMatrix.c, item.worldMatrix.d) || 1,
    alpha: item.worldOpacity,
    visible: item.visible,
    width,
    height,
    zIndex: item.renderOrder,
    kind: item.payload.kind,
  };
}

/** DOM fallback uses the same snapshot contract (R8-V1). */
export function assertSnapshotContract(snapshot: RenderSnapshot): void {
  if (!snapshot.space) throw new Error("RenderSnapshot.space required");
  if (!snapshot.projection || snapshot.projection.kind !== "orthographic") {
    throw new Error("RenderSnapshot.projection.kind must be orthographic");
  }
  for (const item of snapshot.items) {
    if (typeof item.depth !== "number") {
      throw new Error(`Missing depth on ${item.key}`);
    }
    if (!item.projectedOffset) {
      throw new Error(`Missing projectedOffset on ${item.key}`);
    }
  }
}

export {
  createPixiStageRenderer,
  type PixiStageRenderer,
  type StageViewport,
} from "./PixiStageRenderer";
export {
  createPixiFramePainter,
  type PixiFramePainter,
  type PixiFramePainterOptions,
} from "./PixiFramePainter";
export {
  createPixiAssetStore,
  type PixiAssetStore,
  type PixiAssetStoreOptions,
} from "./PixiAssetStore";
export {
  createCompositingContext,
  createRenderTexturePool,
  type CompositingContext,
  type CompositingLayer,
  type OffscreenSlot,
  type NestingFrame,
  type RenderTexturePool,
} from "./pixi-compositing";
export {
  syncPaintBufferToCache,
  type CachedDisplayDesc,
  type DisplayCacheStats,
} from "./display-cache";
