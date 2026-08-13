import type { CompiledProject } from "../compiler";
import { frameTimestamp } from "@motionvideo/motion-runtime";

export type FrameJob = {
  frameIndex: number;
  sceneIndex: number;
  localTime: number;
  globalTime: number;
  layers: FrameLayer[];
};

export type FrameLayer = {
  sceneIndex: number;
  localTime: number;
  opacity: number;
};

export function projectDuration(compiled: CompiledProject): number {
  return compiled.timeline.duration;
}

/**
 * Visible composition layers at a global timestamp.
 * Layer-graph IR has one window: `[0, timeline.duration)`.
 */
export function projectFrameLayers(
  compiled: CompiledProject,
  globalTime: number,
  _fps = 30,
): FrameLayer[] {
  void _fps;
  const duration = projectDuration(compiled);
  if (!(duration > 0) || globalTime < 0 || globalTime >= duration) return [];
  return [{ sceneIndex: 0, localTime: globalTime, opacity: 1 }];
}

/** Deterministic global frame plan — same on main thread and every worker. */
export function buildFramePlan(
  compiled: CompiledProject,
  fps: number,
): FrameJob[] {
  const jobs: FrameJob[] = [];
  const safeFps = Math.max(1, fps);
  const frameCount = Math.max(
    1,
    Math.round(projectDuration(compiled) * safeFps),
  );
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const globalTime = frameTimestamp(frameIndex, safeFps).time;
    const layers = projectFrameLayers(compiled, globalTime, safeFps);
    const primary = layers.at(-1) ?? { sceneIndex: 0, localTime: 0 };
    jobs.push({
      frameIndex,
      sceneIndex: primary.sceneIndex,
      localTime: primary.localTime,
      globalTime,
      layers,
    });
  }
  return jobs;
}

/** Split into N contiguous chunks (frames are independent — any split is safe). */
export function splitFramePlan(jobs: FrameJob[], chunks: number): FrameJob[][] {
  const n = Math.max(1, Math.min(chunks, jobs.length || 1));
  const size = Math.ceil(jobs.length / n);
  const out: FrameJob[][] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(jobs.slice(i * size, (i + 1) * size));
  }
  return out.filter((chunk) => chunk.length > 0);
}
