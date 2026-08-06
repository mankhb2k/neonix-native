import { buildRenderSnapshot, type RenderSnapshot } from "./render-snapshot";
import { frameIndexAtTime } from "./clock";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import {
  resolveTimelineAtTime,
  timelineTotalDuration,
} from "./resolve-timeline";

/**
 * Evaluate a composition frame into a render snapshot (renderer-agnostic).
 *
 * - When `sceneId` is set: frame is local to that scene (legacy / single-scene).
 * - When `sceneId` is omitted: frame is global across `timeline.sceneOrder` (hard cuts).
 */
export function evaluateCompositionSnapshot(
  runtime: NormalizedMotionProjectV2,
  frame: number,
  fps: number,
  width: number,
  height: number,
  sceneId?: string,
  background?: string,
): RenderSnapshot | null {
  const safeFps = Math.max(1, fps);
  const assetUriById = new Map(
    runtime.assets.map((asset) => [asset.id, asset.uri] as const),
  );

  if (sceneId) {
    const scene =
      runtime.scenes.find((candidate) => candidate.id === sceneId) ??
      runtime.scenes[0];
    if (!scene) return null;
    const time = frame / safeFps;
    return buildRenderSnapshot({
      scene,
      time,
      frame,
      width,
      height,
      background,
      assetUriById,
    });
  }

  const globalTime = frame / safeFps;
  const resolved = resolveTimelineAtTime(runtime, globalTime);
  if (!resolved) return null;
  const scene = runtime.scenes.find((s) => s.id === resolved.sceneId);
  if (!scene) return null;
  const localFrame = Math.max(0, Math.round(resolved.localTime * safeFps));
  return buildRenderSnapshot({
    scene,
    time: resolved.localTime,
    frame: localFrame,
    width,
    height,
    background,
    assetUriById,
  });
}

/**
 * Duration in frames.
 * - With `sceneId`: that scene only.
 * - Without: sum of all scenes in `sceneOrder`.
 */
export function compositionDurationInFrames(
  runtime: NormalizedMotionProjectV2,
  sceneId?: string,
  fps = 30,
): number {
  const safeFps = Math.max(1, fps);
  if (sceneId) {
    const scene =
      runtime.scenes.find((candidate) => candidate.id === sceneId) ??
      runtime.scenes[0];
    if (!scene) return Math.max(1, safeFps);
    const duration = Math.max(1 / safeFps, scene.duration ?? 1);
    return Math.max(
      1,
      frameIndexAtTime(duration, safeFps) || Math.ceil(duration * safeFps),
    );
  }

  const total = timelineTotalDuration(runtime);
  const duration = Math.max(1 / safeFps, total > 0 ? total : 1);
  return Math.max(
    1,
    frameIndexAtTime(duration, safeFps) || Math.ceil(duration * safeFps),
  );
}
