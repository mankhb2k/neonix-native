import {
  buildRenderSnapshot,
  frameIndexAtTime,
  type RenderSnapshot,
} from "@motionvideo/motion-runtime";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";

export function evaluateCompositionSnapshot(
  runtime: NormalizedMotionProjectV2,
  frame: number,
  fps: number,
  width: number,
  height: number,
  sceneId?: string,
  background?: string,
): RenderSnapshot | null {
  const scene =
    runtime.scenes.find((candidate) => candidate.id === sceneId) ??
    runtime.scenes[0];
  if (!scene) return null;
  const time = frame / Math.max(1, fps);
  return buildRenderSnapshot({
    scene,
    time,
    frame,
    width,
    height,
    background,
  });
}

export function compositionDurationInFrames(
  runtime: NormalizedMotionProjectV2,
  sceneId?: string,
  fps = 30,
): number {
  const scene =
    runtime.scenes.find((candidate) => candidate.id === sceneId) ??
    runtime.scenes[0];
  if (!scene) return Math.max(1, fps);
  const duration = Math.max(1 / fps, scene.duration ?? 1);
  return Math.max(
    1,
    frameIndexAtTime(duration, fps) || Math.ceil(duration * fps),
  );
}
