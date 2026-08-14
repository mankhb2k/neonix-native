/**
 * Shared multi-scene composition layer plan (AE layer stack).
 *
 * At time t: active clips (start <= t < start+duration) render by zIndex
 * (caller sorts by track.order ascending). No transition primitives.
 */

import { resolveMediaTiming } from "../media-timing";

export type CompositionSceneInput = {
  graphId: string;
  /** Absolute global timeline start (seconds). */
  start: number;
  duration: number;
  trimStart?: number;
  playbackRate?: number;
  loop?: boolean;
  sourceDuration?: number;
  /** Clip opacity (default 1). */
  opacity?: number;
  trackId?: string;
  trackOrder?: number;
};

export type CompositionLayerPlan = {
  graphId: string;
  localTime: number;
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  zIndex: number;
};

export type CompositionFramePlan = {
  globalTime: number;
  width: number;
  height: number;
  layers: CompositionLayerPlan[];
  totalDuration: number;
};

type Segment = {
  graphId: string;
  start: number;
  duration: number;
  trimStart?: number;
  playbackRate?: number;
  loop?: boolean;
  sourceDuration?: number;
  opacity: number;
  trackId?: string;
  trackOrder?: number;
};

function buildSegments(scenes: CompositionSceneInput[]): {
  segments: Segment[];
  totalDuration: number;
} {
  const segments: Segment[] = scenes.map((scene) => ({
    graphId: scene.graphId,
    start: scene.start,
    duration: scene.duration,
    trimStart: scene.trimStart,
    playbackRate: scene.playbackRate,
    loop: scene.loop,
    sourceDuration: scene.sourceDuration,
    opacity: scene.opacity ?? 1,
    trackId: scene.trackId,
    trackOrder: scene.trackOrder,
  }));
  const totalDuration = segments.reduce(
    (max, s) => Math.max(max, s.start + s.duration),
    0,
  );
  return { segments, totalDuration };
}

function effectiveLocalTime(
  seg: Segment,
  compositionLocalTime: number,
  fps: number,
): number {
  return resolveMediaTiming({
    mediaTimeSeconds: compositionLocalTime,
    fps,
    trimStartSeconds: seg.trimStart ?? 0,
    playbackRate: seg.playbackRate ?? 1,
    loop: seg.loop ?? false,
    sourceDurationSeconds: seg.sourceDuration ?? seg.duration,
  }).mediaTimeSeconds;
}

/**
 * Evaluate which scene layers are visible at a global time.
 * Gaps produce no layers. Opacity comes from the clip only.
 */
export function evaluateCompositionLayers(
  scenes: CompositionSceneInput[],
  globalTime: number,
  width: number,
  height: number,
  fps = 30,
): CompositionFramePlan {
  const { segments, totalDuration } = buildSegments(scenes);
  const t = Number.isFinite(globalTime) ? Math.max(0, globalTime) : 0;
  const safeFps = Math.max(1, fps);
  const layers: CompositionLayerPlan[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i]!;
    const compositionLocalTime = t - seg.start;
    if (compositionLocalTime < -1e-9 || compositionLocalTime >= seg.duration) {
      continue;
    }

    layers.push({
      graphId: seg.graphId,
      localTime: effectiveLocalTime(seg, compositionLocalTime, safeFps),
      opacity: seg.opacity,
      translateX: 0,
      translateY: 0,
      scale: 1,
      zIndex: i,
    });
  }

  layers.sort((a, b) => a.zIndex - b.zIndex);
  return { globalTime: t, width, height, layers, totalDuration };
}

export function compositionTotalDuration(
  scenes: CompositionSceneInput[],
): number {
  return buildSegments(scenes).totalDuration;
}
