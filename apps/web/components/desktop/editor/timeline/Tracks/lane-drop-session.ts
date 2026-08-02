/**
 * Shared lane-rect cache + drop-target helpers for clip move / sidebar drag.
 * Prefer DomGeometryAdapter for new code; these wrappers keep existing hooks working.
 */

import type { RefObject } from "react";
import { DomGeometryAdapter } from "../interactions/dom-geometry-adapter";
import {
  absoluteAudioLanes,
  absoluteSceneLanes,
  audioDropPolicy,
  audioHitToLane,
  cacheAudioLanesRelative,
  cacheSceneLanesRelative,
  collectAudioZoneLanes,
  collectSceneLanes,
  resolveLaneDropTarget,
  videoHitToLane,
  visualDropPolicy,
  type RelativeAudioLaneHit,
  type RelativeLaneHit,
  type TimelineDropTarget,
} from "./lane-drop-target";

export type LaneRectCache = {
  scene: RelativeLaneHit[] | null;
  audio: RelativeAudioLaneHit[] | null;
  /** Optional shared adapter — when set, resolve* prefer it. */
  adapter?: DomGeometryAdapter | null;
};

export function createEmptyLaneRectCache(): LaneRectCache {
  return { scene: null, audio: null, adapter: null };
}

export function invalidateLaneRectCache(cache: LaneRectCache): void {
  // Mutable session cache held by hook refs.
  // eslint-disable-next-line no-param-reassign -- intentional in-place invalidate
  cache.scene = null;
  // eslint-disable-next-line no-param-reassign -- intentional in-place invalidate
  cache.audio = null;
  cache.adapter?.invalidateAll();
}

/** Ensure scene cache — recache nếu đã invalidate. */
export function ensureSceneLaneCache(
  cache: LaneRectCache,
  workspace: HTMLElement,
  wsTop: number,
): RelativeLaneHit[] {
  if (!cache.scene) {
    // eslint-disable-next-line no-param-reassign -- intentional session recache
    cache.scene = cacheSceneLanesRelative(workspace, wsTop);
  }
  return cache.scene;
}

export function ensureAudioLaneCache(
  cache: LaneRectCache,
  workspace: HTMLElement,
  wsTop: number,
): RelativeAudioLaneHit[] {
  if (!cache.audio) {
    // eslint-disable-next-line no-param-reassign -- intentional session recache
    cache.audio = cacheAudioLanesRelative(workspace, wsTop);
  }
  return cache.audio;
}

export function resolveVisualDropAtPointer(
  cache: LaneRectCache,
  workspace: HTMLElement,
  clientY: number,
  wasInsert: boolean,
  maxOverlayOrder: number,
): TimelineDropTarget | null {
  if (cache.adapter) {
    return cache.adapter.resolveVisualDrop(
      clientY,
      wasInsert,
      maxOverlayOrder,
    );
  }
  const wsTop = workspace.getBoundingClientRect().top;
  const relative = ensureSceneLaneCache(cache, workspace, wsTop);
  const lanes =
    relative.length > 0
      ? absoluteSceneLanes(relative, wsTop)
      : collectSceneLanes(workspace);
  return resolveLaneDropTarget(
    clientY,
    lanes.map(videoHitToLane),
    wsTop,
    wasInsert,
    maxOverlayOrder,
    visualDropPolicy,
  );
}

export function resolveAudioDropAtPointer(
  cache: LaneRectCache,
  workspace: HTMLElement,
  clientY: number,
  wasInsert: boolean,
  maxAudioOrder: number,
): TimelineDropTarget | null {
  if (cache.adapter) {
    return cache.adapter.resolveAudioDrop(clientY, wasInsert, maxAudioOrder);
  }
  const wsTop = workspace.getBoundingClientRect().top;
  const relative = ensureAudioLaneCache(cache, workspace, wsTop);
  const lanes =
    relative.length > 0
      ? absoluteAudioLanes(relative, wsTop)
      : collectAudioZoneLanes(workspace);
  return resolveLaneDropTarget(
    clientY,
    lanes.map(audioHitToLane),
    wsTop,
    wasInsert,
    maxAudioOrder,
    audioDropPolicy,
  );
}

/** Bind scroll/resize → invalidate cache (caller owns cache ref). */
export function bindLaneCacheInvalidation(
  scrollContainerRef: RefObject<HTMLElement | null>,
  workspaceRef: RefObject<HTMLElement | null>,
  cache: LaneRectCache,
  onInvalidated?: () => void,
): () => void {
  if (cache.adapter) {
    cache.adapter.bind(workspaceRef.current, scrollContainerRef.current);
    return cache.adapter.bindInvalidation(onInvalidated);
  }
  const invalidate = () => {
    invalidateLaneRectCache(cache);
    onInvalidated?.();
  };
  const root = scrollContainerRef.current;
  const ws = workspaceRef.current;
  root?.addEventListener("scroll", invalidate, { passive: true });
  ws?.addEventListener("scroll", invalidate, { passive: true });
  window.addEventListener("resize", invalidate);
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(invalidate);
  if (root) resizeObserver?.observe(root);
  if (ws) resizeObserver?.observe(ws);
  return () => {
    root?.removeEventListener("scroll", invalidate);
    ws?.removeEventListener("scroll", invalidate);
    window.removeEventListener("resize", invalidate);
    resizeObserver?.disconnect();
  };
}
