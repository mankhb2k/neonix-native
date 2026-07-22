import { workerData, parentPort } from "node:worker_threads";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { drawSceneFrame } from "./draw";
import type { CompiledProject } from "../compiler";
import type { FrameJob } from "./frame-plan";

export type FrameWorkerInput = {
  compiled: CompiledProject;
  width: number;
  height: number;
  outDir: string;
  jobs: FrameJob[];
};

async function run() {
  const { compiled, width, height, outDir, jobs } =
    workerData as FrameWorkerInput;

  for (const job of jobs) {
    const scene = compiled.scenes[job.sceneIndex];
    if (!scene) continue;
    const png = drawSceneFrame(scene, compiled.brand, job.localTime, width, height);
    const name = `frame_${String(job.frameIndex).padStart(6, "0")}.png`;
    await writeFile(path.join(outDir, name), png);
  }

  parentPort?.postMessage({ ok: true, count: jobs.length });
}

run().catch((err) => {
  parentPort?.postMessage({
    ok: false,
    error: err instanceof Error ? err.stack ?? err.message : String(err),
  });
});
