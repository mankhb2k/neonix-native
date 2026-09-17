import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { ExportRendererError } from "../errors";
import type { FrameRange } from "./frame-range-scheduler";
import type { ExportRenderOptions, ExportRenderStats } from "./types";

type NativeCommandBenchmarkResult = {
  actualBackend?: string;
  frames?: number;
  durationSeconds?: number;
  outputBytes?: number;
  timingsMs?: Record<string, number>;
  nativeMetrics?: {
    timingsMs?: Record<string, number>;
  };
};

function nativeCommandStats(
  project: RuntimeProjectV3,
  outputPath: string,
  range: FrameRange,
  result: NativeCommandBenchmarkResult,
): ExportRenderStats {
  const timings = result.timingsMs ?? result.nativeMetrics?.timingsMs ?? {};
  const fps = project.visual.composition.fps;
  const frames = Number(result.frames ?? (range.endFrameExclusive - range.startFrame));
  const durationSeconds = Number(result.durationSeconds ?? (frames / fps));
  const renderMilliseconds = Number(timings.nativeRender ?? 0)
    + Number(timings.nativeComposite ?? 0)
    + Number(timings.nativeReadback ?? 0);
  const encodeMilliseconds = Number(timings.encode ?? 0)
    + Number(timings.mux ?? 0)
    + Number(timings.finalize ?? 0);
  return {
    projectId: project.projectId,
    backendIdentity: {
      requestedBackend: "raster",
      actualBackend: result.actualBackend ?? "skia-native-raster",
      surfaceKind: "raster",
      softwareRenderer: true,
    },
    width: project.visual.composition.width,
    height: project.visual.composition.height,
    fps,
    frames,
    durationSeconds,
    outputPath,
    outputBytes: Number(result.outputBytes ?? 0),
    renderMilliseconds,
    encodeMilliseconds,
    encodeBreakdown: {
      framesSubmitted: frames,
      pipeWriteMilliseconds: 0,
      backpressureWaitMilliseconds: 0,
      finalizeMilliseconds: Number(timings.finalize ?? 0),
    },
    renderBreakdown: {
      evaluateMilliseconds: Number(timings.evaluate ?? 0),
      assetMilliseconds: 0,
      paintAndReadbackMilliseconds: renderMilliseconds,
      replayMilliseconds: Number(timings.nativeRender ?? 0),
      flushMilliseconds: Number(timings.nativeComposite ?? 0),
      readbackMilliseconds: Number(timings.nativeReadback ?? 0),
      drawCalls: 0,
      textMilliseconds: 0,
      layerMilliseconds: 0,
      endLayerMilliseconds: 0,
      pathMilliseconds: 0,
      shapeMilliseconds: 0,
      offscreenSurfaceCreates: 0,
      offscreenSurfaceReuses: 0,
      filterCacheHits: 0,
      maskCacheHits: 0,
    },
  };
}

function hasTimelineContent(project: RuntimeProjectV3): { audio: boolean; video: boolean } {
  return {
    audio: project.audioTimeline.tracks.some((track) => track.clips.length > 0),
    video: project.videoTimeline.instances.length > 0,
  };
}

/**
 * The only MP4 export bridge. CanvasKit is deliberately not a fallback here.
 * Unsupported native command features fail closed until their parity work lands.
 */
export async function renderNativeCommandBuffer(
  project: RuntimeProjectV3,
  options: ExportRenderOptions,
  range: FrameRange,
): Promise<ExportRenderStats> {
  if (options.renderer === "svg") {
    throw new ExportRendererError(
      "SVG/CanvasKit export is disabled. MP4 export uses native Skia only; use renderOneFrameToSvg for preview.",
      "UNSUPPORTED_COMMAND",
    );
  }
  const timeline = hasTimelineContent(project);
  if (timeline.audio || timeline.video) {
    throw new ExportRendererError(
      "Native Skia export currently accepts visual-only command buffers. Audio/video parity is not implemented yet; CanvasKit fallback is disabled.",
      "UNSUPPORTED_COMMAND",
      { audio: timeline.audio, video: timeline.video },
    );
  }
  if (!Number.isInteger(range.startFrame) || !Number.isInteger(range.endFrameExclusive)
    || range.startFrame < 0 || range.endFrameExclusive <= range.startFrame) {
    throw new ExportRendererError("Invalid frame range.", "INVALID_PROJECT", { range });
  }
  if (options.signal?.aborted) throw new ExportRendererError("Render was cancelled.", "CANCELLED");

  const outputPath = options.outputPath;
  await mkdir(dirname(outputPath), { recursive: true });
  const runtimePath = join(dirname(outputPath), `.runtime-native-${process.pid}-${Date.now()}.json`);
  await writeFile(runtimePath, `${JSON.stringify(project)}\n`, "utf8");
  const command = process.env.PNPM_PATH?.trim() || (process.platform === "win32" ? "pnpm.cmd" : "pnpm");
  const args = ["--filter", "@motionvideo/export-renderer", "exec", "tsx", "src/benchmark-native-skia-command-cpu.ts"];
  const fps = project.visual.composition.fps;
  const frameCount = range.endFrameExclusive - range.startFrame;
  const durationSeconds = frameCount / fps;
  const childEnvironment = {
    ...process.env,
    BENCHMARK_RUNTIME_JSON_PATH: runtimePath,
    BENCHMARK_MODE: "in-process",
    BENCHMARK_OUTPUT: outputPath,
    BENCHMARK_DURATION_SECONDS: String(durationSeconds),
    BENCHMARK_FRAMES: String(frameCount),
    BENCHMARK_START_FRAME: String(range.startFrame),
    BENCHMARK_END_FRAME: String(range.endFrameExclusive),
    BENCHMARK_PROTOCOL_BATCH_FRAMES: "1",
    BENCHMARK_PROTOCOL_TRANSPORT: "pipe",
    BENCHMARK_COLOR_CONVERTER: "libyuv",
    BENCHMARK_SURFACE_MODE: "direct-raster",
    BENCHMARK_KEEP_RAW: "false",
  };
  const stdout: string[] = [];
  const stderr: string[] = [];
  options.onProgress?.({ stage: "rendering", completedFrames: 0, totalFrames: frameCount });
  try {
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolveProcess, reject) => {
      const child = spawn(command, args, {
        cwd: process.env.RENDERER_WORKDIR?.trim() || process.cwd(),
        env: childEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
        // Windows exposes pnpm as a .cmd shim, which Node 24 cannot spawn
        // directly without a shell. Cloud Run/Linux keeps the direct path.
        shell: process.platform === "win32",
      });
      child.stdout.on("data", (chunk: Buffer) => { stdout.push(chunk.toString()); });
      child.stderr.on("data", (chunk: Buffer) => { stderr.push(chunk.toString()); });
      child.once("error", reject);
      child.once("close", (code) => resolveProcess({ code: code ?? 1, stdout: stdout.join(""), stderr: stderr.join("") }));
    });
    if (result.code !== 0) {
      throw new ExportRendererError(
        `Native Skia renderer exited with ${result.code}: ${result.stderr.slice(-4000) || result.stdout.slice(-4000)}`,
        "OUTPUT_FAILED",
      );
    }
    const metricLine = [...result.stderr.matchAll(/BENCHMARK_RESULT\s+(\{.*\})/g)].at(-1)?.[1]
      ?? result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (!metricLine) throw new ExportRendererError("Native Skia renderer returned no metrics.", "OUTPUT_FAILED");
    let metrics: NativeCommandBenchmarkResult;
    try {
      metrics = JSON.parse(metricLine) as NativeCommandBenchmarkResult;
    } catch {
      throw new ExportRendererError(`Native Skia renderer returned invalid metrics: ${metricLine.slice(0, 1000)}`, "OUTPUT_FAILED");
    }
    options.onProgress?.({ stage: "rendering", completedFrames: frameCount, totalFrames: frameCount });
    options.onProgress?.({ stage: "encoding", completedFrames: frameCount, totalFrames: frameCount });
    return nativeCommandStats(project, outputPath, range, metrics);
  } finally {
    await rm(runtimePath, { force: true }).catch(() => undefined);
  }
}
