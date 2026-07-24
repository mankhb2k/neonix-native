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

function overlapDuration(scene: CompiledProject["scenes"][number]): number {
  return scene.transition?.type === "fade" || scene.transition?.type === "crossfade"
    ? scene.transition.duration
    : 0;
}

export function sceneStartTimes(compiled: CompiledProject): number[] {
  const starts: number[] = [];
  let start = 0;
  compiled.scenes.forEach((scene) => {
    starts.push(start);
    start += scene.duration - overlapDuration(scene);
  });
  return starts;
}

export function projectDuration(compiled: CompiledProject): number {
  const starts = sceneStartTimes(compiled);
  const lastIndex = compiled.scenes.length - 1;
  return lastIndex < 0 ? 0 : starts[lastIndex]! + compiled.scenes[lastIndex]!.duration;
}

/** Returns ordered scene layers at a global project timestamp. */
export function projectFrameLayers(compiled: CompiledProject, globalTime: number): FrameLayer[] {
  const starts = sceneStartTimes(compiled);
  return compiled.scenes.flatMap((scene, sceneIndex) => {
    const localTime = globalTime - starts[sceneIndex]!;
    if (localTime < 0 || localTime >= scene.duration) return [];
    let opacity = 1;
    const outgoing = overlapDuration(scene);
    if (outgoing > 0 && localTime >= scene.duration - outgoing) {
      opacity *= (scene.duration - localTime) / outgoing;
    }
    const previous = compiled.scenes[sceneIndex - 1];
    const incoming = previous ? overlapDuration(previous) : 0;
    if (incoming > 0 && localTime < incoming) opacity *= localTime / incoming;
    return [{ sceneIndex, localTime, opacity }];
  });
}

/** Deterministic global frame plan — same on main thread and every worker. */
export function buildFramePlan(
  compiled: CompiledProject,
  fps: number,
): FrameJob[] {
  const jobs: FrameJob[] = [];
  const frameCount = Math.max(1, Math.round(projectDuration(compiled) * fps));
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const globalTime = frameTimestamp(frameIndex, fps).time;
    const layers = projectFrameLayers(compiled, globalTime);
    const primary = layers.at(-1) ?? { sceneIndex: 0, localTime: 0 };
    jobs.push({ frameIndex, sceneIndex: primary.sceneIndex, localTime: primary.localTime, globalTime, layers });
  }
  return jobs;
}

/** Split into N contiguous chunks (frames are independent — any split is safe). */
export function chunkFramePlan(jobs: FrameJob[], chunks: number): FrameJob[][] {
  const size = Math.ceil(jobs.length / chunks);
  const out: FrameJob[][] = [];
  for (let i = 0; i < jobs.length; i += size) {
    out.push(jobs.slice(i, i + size));
  }
  return out;
}
