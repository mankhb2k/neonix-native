import os from "node:os";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { CompiledProject } from "../compiler";
import { sizeForAspect } from "./draw";
import { buildFramePlan, chunkFramePlan } from "./frame-plan";
import type { FrameWorkerInput } from "./frame-worker";

export { sizeForAspect } from "./draw";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const FRAME_WORKER_URL = new URL("./frame-worker.ts", import.meta.url);

export type RenderResult = {
  projectId: string;
  framesDir: string;
  frameCount: number;
  fps: number;
  width: number;
  height: number;
  durationSec: number;
};

export type RenderOptions = {
  /** Output directory for PNG sequence */
  outDir?: string;
  fps?: number;
  /** Scale vs full HD (0.5 = half for faster e2e) */
  scale?: number;
  /** Parallel worker threads — default: CPU cores, capped at 8 */
  concurrency?: number;
  /** Base directory used to resolve safe relative asset URIs. */
  assetBaseDir?: string;
};

function runFrameWorker(input: FrameWorkerInput): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(FRAME_WORKER_URL, { workerData: input });
    worker.once("message", (msg: { ok: boolean; error?: string }) => {
      worker.terminate();
      if (msg.ok) resolve();
      else reject(new Error(msg.error ?? "frame worker failed"));
    });
    worker.once("error", (err) => {
      worker.terminate();
      reject(err);
    });
  });
}

/**
 * Reference renderer — NOT Motion Canvas.
 * Proves Motion IR → pixels; swap this module later without changing schema.
 * Frames are independent (per-scene local time), so they're rasterized in
 * parallel across worker threads — one thread per CPU core by default.
 */
export async function renderCompiledProject(
  compiled: CompiledProject,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const fps = options.fps ?? 15;
  const scale = options.scale ?? 0.5;
  const { width, height } = sizeForAspect(compiled.metadata.aspectRatio, scale);
  const outDir =
    options.outDir ?? path.join(REPO_ROOT, "tmp", "frames", compiled.metadata.id);
  const assetBaseDir = path.resolve(options.assetBaseDir ?? REPO_ROOT);

  await mkdir(outDir, { recursive: true });

  const jobs = buildFramePlan(compiled, fps);
  const cpuCount = os.availableParallelism?.() ?? os.cpus().length;
  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? cpuCount, 8, jobs.length),
  );
  const chunks = chunkFramePlan(jobs, concurrency);

  await Promise.all(
    chunks
      .filter((chunk) => chunk.length > 0)
      .map((chunk) =>
        runFrameWorker({ compiled, width, height, outDir, assetBaseDir, jobs: chunk }),
      ),
  );

  return {
    projectId: compiled.metadata.id,
    framesDir: outDir,
    frameCount: jobs.length,
    fps,
    width,
    height,
    durationSec: compiled.scenes.reduce((sum, scene) => sum + scene.duration, 0),
  };
}
