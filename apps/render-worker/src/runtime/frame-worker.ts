import { workerData, parentPort } from "node:worker_threads";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { drawProjectFrame } from "./draw";
import { drawProjectFramePaint } from "./paint-canvas";
import type { CompiledProject } from "../compiler";
import type { FrameJob } from "./frame-plan";

export type FrameWorkerInput = {
  compiled: CompiledProject;
  width: number;
  height: number;
  outDir: string;
  assetBaseDir: string;
  jobs: FrameJob[];
  /** Use shared PaintCommandBuffer → canvas (P6). */
  paintPath?: boolean;
};

async function run() {
  const { compiled, width, height, outDir, assetBaseDir, jobs, paintPath } =
    workerData as FrameWorkerInput;

  const draw = paintPath ? drawProjectFramePaint : drawProjectFrame;

  for (const job of jobs) {
    const png = await draw(compiled, job.globalTime, width, height, assetBaseDir);
    const name = `frame_${String(job.frameIndex).padStart(6, "0")}.png`;
    await writeFile(path.join(outDir, name), png);
    parentPort?.postMessage({
      type: "progress",
      frameIndex: job.frameIndex,
      done: false,
    });
  }

  parentPort?.postMessage({ ok: true, count: jobs.length });
}

run().catch((err) => {
  parentPort?.postMessage({
    ok: false,
    error: err instanceof Error ? err.stack ?? err.message : String(err),
  });
});
