import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { ExportRendererError } from "../errors";
import { concatMp4Segments } from "./ffmpeg";
import { planFrameRanges, runFrameRangeTasks, type FrameChunk, type FrameRange } from "./frame-range-scheduler";
import type { ExportRenderOptions, ExportRenderProgress, ExportRenderStats, RuntimeFrameEvaluator } from "./types";

type ChunkWorkerStats = ExportRenderStats;

type ChunkResult = {
  stats: ChunkWorkerStats;
  checksum: string;
};

type ChunkWorkerRequest = {
  project: RuntimeProjectV3;
  outputPath: string;
  range: FrameRange;
  assetRoot: string;
  ffmpegPath: string;
  ffmpegLogLevel?: ExportRenderOptions["ffmpegLogLevel"];
  ffmpegPreset?: string;
  ffmpegCrf?: number;
  ffmpegThreads?: number;
};

function positiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

async function renderChunkInProcess(
  project: RuntimeProjectV3,
  options: ExportRenderOptions,
  segmentPath: string,
  chunk: FrameChunk,
  onProgress: (completedFrames: number, totalFrames: number) => void,
): Promise<ChunkResult> {
  const workerScript = fileURLToPath(new URL("./chunk-worker.ts", import.meta.url));
  const request: ChunkWorkerRequest = {
    project,
    outputPath: segmentPath,
    range: { startFrame: chunk.startFrame, endFrameExclusive: chunk.endFrameExclusive },
    assetRoot: options.assetRoot as string,
    ffmpegPath: options.ffmpegPath ?? "ffmpeg",
    ffmpegLogLevel: options.ffmpegLogLevel,
    ffmpegPreset: options.ffmpegPreset,
    ffmpegCrf: options.ffmpegCrf,
    ffmpegThreads: options.ffmpegThreads,
  };
  const child = spawn(process.execPath, ["--import", "tsx", workerScript], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let result: ChunkWorkerStats | undefined;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (data: string) => {
    stdout += data;
    const lines = stdout.split("\n");
    stdout = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line) as { type?: string; completedFrames?: number; totalFrames?: number; stats?: ChunkWorkerStats };
        if (message.type === "progress") {
          onProgress(message.completedFrames ?? 0, message.totalFrames ?? chunk.endFrameExclusive - chunk.startFrame);
        } else if (message.type === "result") {
          result = message.stats;
        }
      } catch {
        stderr += `\n${line}`;
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (data: string) => { stderr += data; });

  const exit = new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
  const abort = (): void => { child.kill(); };
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    child.stdin.end(JSON.stringify(request));
    const code = await exit;
    if (code !== 0 || !result) {
      throw new ExportRendererError(
        `Frame chunk ${chunk.chunkId} failed: ${stderr.trim() || "worker exited without a result"}`,
        "OUTPUT_FAILED",
        { code, chunk, stdout, stderr },
      );
    }
    const workerResult = result;
    const hash = createHash("sha256");
    await new Promise<void>((resolveHash, reject) => {
      const stream = createReadStream(workerResult.outputPath);
      stream.on("data", (data) => hash.update(data));
      stream.once("error", reject);
      stream.once("end", resolveHash);
    });
    const output = await stat(workerResult.outputPath);
    if (output.size < 1) throw new ExportRendererError(`Frame chunk ${chunk.chunkId} produced an empty segment.`, "OUTPUT_FAILED", { chunk });
    return { stats: workerResult, checksum: hash.digest("hex") };
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function renderParallelFrameRanges(
  project: RuntimeProjectV3,
  options: ExportRenderOptions,
  range: FrameRange,
  _evaluator: RuntimeFrameEvaluator,
  _preparedProject: unknown,
): Promise<ExportRenderStats> {
  const frameCount = range.endFrameExclusive - range.startFrame;
  const requestedParallelism = positiveInteger(Number(options.parallelism ?? 1), 1);
  const configuredChunkSize = Number(options.chunkSize ?? process.env.EXPORT_RENDERER_CHUNK_SIZE ?? 300);
  const chunkSize = positiveInteger(configuredChunkSize, Math.min(300, frameCount));
  const maxRetries = nonNegativeInteger(Number(options.chunkRetries ?? process.env.EXPORT_RENDERER_CHUNK_RETRIES ?? 1), 1);
  const ranges = planFrameRanges(frameCount, chunkSize).map((chunk) => ({
    startFrame: chunk.startFrame + range.startFrame,
    endFrameExclusive: chunk.endFrameExclusive + range.startFrame,
  }));
  const segmentDirectory = await mkdtemp(join(dirname(options.outputPath), ".neonix-segments-"));
  const progress = new Map<string, number>();
  const started = performance.now();
  const report = (stage: ExportRenderProgress["stage"]): void => {
    options.onProgress?.({
      stage,
      completedFrames: stage === "rendering" ? [...progress.values()].reduce((sum, value) => sum + value, 0) : frameCount,
      totalFrames: frameCount,
    });
  };

  try {
    report("rendering");
    const completed = await runFrameRangeTasks(ranges, {
      concurrency: Math.min(requestedParallelism, ranges.length),
      maxRetries,
      signal: options.signal,
      task: async (chunk) => {
        progress.set(chunk.chunkId, 0);
        const segmentPath = join(segmentDirectory, `${chunk.chunkId}.attempt-${chunk.attempt}.mp4`);
        return renderChunkInProcess(project, options, segmentPath, chunk, (completedFrames) => {
          progress.set(chunk.chunkId, completedFrames);
          report("rendering");
        });
      },
    });

    const segments = completed
      .sort((left, right) => left.chunk.startFrame - right.chunk.startFrame)
      .map(({ result }) => result.stats.outputPath);
    report("encoding");
    const concatenated = await concatMp4Segments({
      ffmpegPath: options.ffmpegPath ?? "ffmpeg",
      segmentPaths: segments,
      outputPath: options.outputPath,
      logLevel: options.ffmpegLogLevel,
      signal: options.signal,
    });
    const elapsed = performance.now() - started;
    const retryCount = completed.reduce((sum, item) => sum + item.chunk.attempt - 1, 0);
    const chunkChecksums = Object.fromEntries(completed.map(({ chunk, result }) => [chunk.chunkId, result.checksum]));
    return {
      projectId: project.projectId,
      backendIdentity: completed[0]?.result.stats.backendIdentity,
      width: project.visual.composition.width,
      height: project.visual.composition.height,
      fps: project.visual.composition.fps,
      frames: frameCount,
      durationSeconds: frameCount / project.visual.composition.fps,
      outputPath: options.outputPath,
      outputBytes: concatenated.outputBytes,
      renderMilliseconds: Math.max(0, elapsed - concatenated.encodeMilliseconds),
      encodeMilliseconds: concatenated.encodeMilliseconds,
      scheduler: {
        strategy: "parallel-segments",
        requestedParallelism,
        actualParallelism: Math.min(requestedParallelism, ranges.length),
        chunkSize,
        chunkCount: ranges.length,
        retryCount,
        chunkChecksums,
      },
    };
  } finally {
    await rm(segmentDirectory, { recursive: true, force: true });
  }
}
