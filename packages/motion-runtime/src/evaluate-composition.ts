import { type RenderSnapshot } from "./render-snapshot";
import { frameIndexAtTime } from "./clock";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import {
  resolveTimelineAtTime,
  timelineTotalDuration,
} from "./resolve-timeline";
import { evaluateFrame, type EvaluatedFrame } from "./evaluated-frame";

function resolveCompositionEvaluateTarget(
  runtime: NormalizedMotionProjectV2,
  frame: number,
  fps: number,
  sceneId?: string,
): {
  scene: NormalizedMotionProjectV2["scenes"][number];
  time: number;
  frame: number;
} | null {
  const safeFps = Math.max(1, fps);

  if (sceneId) {
    const scene =
      runtime.scenes.find((candidate) => candidate.id === sceneId) ??
      runtime.scenes[0];
    if (!scene) return null;
    return { scene, time: frame / safeFps, frame };
  }

  const globalTime = frame / safeFps;
  const resolved = resolveTimelineAtTime(runtime, globalTime);
  if (!resolved) return null;
  const scene = runtime.scenes.find((s) => s.id === resolved.sceneId);
  if (!scene) return null;
  const localFrame = Math.max(0, Math.round(resolved.localTime * safeFps));
  return { scene, time: resolved.localTime, frame: localFrame };
}

/**
 * Evaluate a composition frame into the shared {@link EvaluatedFrame} contract
 * (interaction snapshot + paint buffer + diagnostics).
 *
 * - When `sceneId` is set: frame is local to that scene.
 * - When `sceneId` is omitted: frame is global across `timeline.sceneOrder` (hard cuts).
 *
 * Preview / export hosts should call this once per tick and feed both painter and overlay.
 */
export function evaluateCompositionFrame(
  runtime: NormalizedMotionProjectV2,
  frame: number,
  fps: number,
  width: number,
  height: number,
  sceneId?: string,
  background?: string,
): EvaluatedFrame | null {
  const target = resolveCompositionEvaluateTarget(runtime, frame, fps, sceneId);
  if (!target) return null;
  const assetUriById = new Map(
    runtime.assets.map((asset) => [asset.id, asset.uri] as const),
  );
  return evaluateFrame({
    scene: target.scene,
    time: target.time,
    frame: target.frame,
    width,
    height,
    background,
    assetUriById,
  });
}

/**
 * Evaluate a composition frame into a render snapshot (renderer-agnostic).
 * Derived from {@link evaluateCompositionFrame} so interaction matches paint.
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
  return (
    evaluateCompositionFrame(
      runtime,
      frame,
      fps,
      width,
      height,
      sceneId,
      background,
    )?.interaction ?? null
  );
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
