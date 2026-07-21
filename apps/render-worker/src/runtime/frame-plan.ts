import type { CompiledProject } from "../compiler";

export type FrameJob = {
  frameIndex: number;
  sceneIndex: number;
  localTime: number;
};

/** Deterministic global frame plan — same on main thread and every worker. */
export function buildFramePlan(
  compiled: CompiledProject,
  fps: number,
): FrameJob[] {
  const jobs: FrameJob[] = [];
  let frameIndex = 0;
  compiled.scenes.forEach((scene, sceneIndex) => {
    const sceneFrames = Math.max(1, Math.round(scene.duration * fps));
    for (let i = 0; i < sceneFrames; i++) {
      jobs.push({ frameIndex, sceneIndex, localTime: i / fps });
      frameIndex += 1;
    }
  });
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
