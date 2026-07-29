/**
 * Shared lane-rect cache + drop-target helpers for clip move / sidebar drag.
 * Không phải Zustand — pure + mutable session cache trong hook ref.
 */

import {
  absoluteAudioLanes,
  absoluteSceneLanes,
  cacheAudioLanesRelative,
  cacheSceneLanesRelative,
  collectAudioZoneLanes,
  collectSceneLanes,
  resolveAudioDragTarget,
  resolveOverlayDragTarget,
  type RelativeAudioLaneHit,
  type RelativeLaneHit,
  type AudioDragTarget,
  type OverlayDragTarget,
} from "./lane-drop-target";
import type { RefObject } from "react";

export type LaneRectCache = {
  scene: RelativeLaneHit[] | null;
  audio: RelativeAudioLaneHit[] | null;
};

export function createEmptyLaneRectCache(): LaneRectCache {
  return { scene: null, audio: null };
}

export function invalidateLaneRectCache(cache: LaneRectCache): void {
  // Mutable session cache held by hook refs.
  // eslint-disable-next-line no-param-reassign -- intentional in-place invalidate
  cache.scene = null;
  // eslint-disable-next-line no-param-reassign -- intentional in-place invalidate
  cache.audio = null;
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
): OverlayDragTarget | null {
  const wsTop = workspace.getBoundingClientRect().top;
  const relative = ensureSceneLaneCache(cache, workspace, wsTop);
  const lanes =
    relative.length > 0
      ? absoluteSceneLanes(relative, wsTop)
      : collectSceneLanes(workspace);
  return resolveOverlayDragTarget(
    clientY,
    lanes,
    wsTop,
    wasInsert,
    maxOverlayOrder,
  );
}

export function resolveAudioDropAtPointer(
  cache: LaneRectCache,
  workspace: HTMLElement,
  clientY: number,
  wasInsert: boolean,
  maxAudioOrder: number,
): AudioDragTarget | null {
  const wsTop = workspace.getBoundingClientRect().top;
  const relative = ensureAudioLaneCache(cache, workspace, wsTop);
  const lanes =
    relative.length > 0
      ? absoluteAudioLanes(relative, wsTop)
      : collectAudioZoneLanes(workspace);
  return resolveAudioDragTarget(
    clientY,
    lanes,
    wsTop,
    wasInsert,
    maxAudioOrder,
  );
}

/** Bind scroll/resize → invalidate cache (caller owns cache ref). */
export function bindLaneCacheInvalidation(
  scrollContainerRef: RefObject<HTMLElement | null>,
  workspaceRef: RefObject<HTMLElement | null>,
  cache: LaneRectCache,
): () => void {
  const invalidate = () => invalidateLaneRectCache(cache);
  const root = scrollContainerRef.current;
  const ws = workspaceRef.current;
  root?.addEventListener("scroll", invalidate, { passive: true });
  ws?.addEventListener("scroll", invalidate, { passive: true });
  window.addEventListener("resize", invalidate);
  return () => {
    root?.removeEventListener("scroll", invalidate);
    ws?.removeEventListener("scroll", invalidate);
    window.removeEventListener("resize", invalidate);
  };
}
