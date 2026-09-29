import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { evaluateRuntimeProjectV3, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { ExportRendererError } from "../errors";
import type { FrameRange } from "./frame-range-scheduler";
import type { ExportRenderOptions, ExportRenderStats } from "./types";
import { encodeEndOfStream, encodeFrame, encodeProtocolHeader } from "./native-protocol";

type NativeBackendMetrics = {
  ok?: boolean;
  actualBackend?: string;
  frames?: number;
  timingsMs?: Record<string, number>;
};

function nativeCommandStats(
  project: RuntimeProjectV3,
  outputPath: string,
  outputBytes: number,
  evaluateMilliseconds: number,
  range: FrameRange,
  result: NativeBackendMetrics,
): ExportRenderStats {
  // These key names (render/composite/readback/encode/mux/finalize) come
  // straight off the native binary's own stderr JSON (see the final
  // std::fprintf in native/main.cpp's main()) — no wrapper
  // process renames them anymore.
  const timings = result.timingsMs ?? {};
  const fps = project.visual.composition.fps;
  const frames = Number(result.frames ?? (range.endFrameExclusive - range.startFrame));
  const durationSeconds = frames / fps;
  const renderMilliseconds = Number(timings.render ?? 0)
    + Number(timings.composite ?? 0)
    + Number(timings.readback ?? 0);
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
    outputBytes,
    renderMilliseconds,
    encodeMilliseconds,
    encodeBreakdown: {
      framesSubmitted: frames,
      pipeWriteMilliseconds: 0,
      backpressureWaitMilliseconds: 0,
      finalizeMilliseconds: Number(timings.finalize ?? 0),
    },
    renderBreakdown: {
      evaluateMilliseconds,
      assetMilliseconds: 0,
      paintAndReadbackMilliseconds: renderMilliseconds,
      replayMilliseconds: Number(timings.render ?? 0),
      flushMilliseconds: Number(timings.composite ?? 0),
      readbackMilliseconds: Number(timings.readback ?? 0),
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
  const frameCount = range.endFrameExclusive - range.startFrame;

  // Talks to `native/main.cpp` (backed by protocol.cpp/paint.cpp/effects.cpp/
  // encoder.cpp) directly over stdin/stderr
  // (the `NXSKIA02` protocol from ./native-protocol) instead of shelling out
  // to a second Node process (the old path spawned the bundled benchmark
  // script, which re-encoded the project from a temp JSON file and then
  // spawned this same binary itself) — one process hop and one temp-file
  // round trip removed from every export.
  const nativeBinary = process.env.NATIVE_SKIA_BINARY?.trim() || "/usr/local/bin/neonix-skia-command-cpu-backend";
  const nativeEnvironment: NodeJS.ProcessEnv = { ...process.env };
  const nativeLibraryPath = process.env.BENCHMARK_NATIVE_LD_LIBRARY_PATH?.trim();
  if (nativeLibraryPath) {
    nativeEnvironment.LD_LIBRARY_PATH = [nativeLibraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  }
  const child = spawn(nativeBinary, [
    "--no-raw", "--in-process", "--output", outputPath,
    "--converter", "libyuv", "--surface-mode", "direct-raster",
  ], {
    cwd: process.env.RENDERER_WORKDIR?.trim() || process.cwd(),
    env: nativeEnvironment,
    stdio: ["pipe", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  // If the native process dies mid-write, the next stdin write fails with
  // EPIPE. A Writable's unhandled 'error' event crashes the whole Node
  // process (bypassing every try/catch, including this function's own),
  // so this listener turns it into an ordinary, catchable failure instead.
  let stdinError: Error | undefined;
  child.stdin?.on("error", (error: Error) => { stdinError = error; });
  const exitCode = waitForExit(child);

  options.onProgress?.({ stage: "rendering", completedFrames: 0, totalFrames: frameCount });
  try {
    await writeToNativeStdin(child, stdinError, encodeProtocolHeader(
      project.visual.composition.width,
      project.visual.composition.height,
      frameCount,
    ));
    let evaluateMilliseconds = 0;
    for (let frame = range.startFrame; frame < range.endFrameExclusive; frame += 1) {
      if (options.signal?.aborted) throw new ExportRendererError("Render was cancelled.", "CANCELLED");
      const evaluateStarted = performance.now();
      const evaluated = evaluateRuntimeProjectV3(project, frame);
      evaluateMilliseconds += performance.now() - evaluateStarted;
      await writeToNativeStdin(child, stdinError, encodeFrame(frame, evaluated));
    }
    await writeToNativeStdin(child, stdinError, encodeEndOfStream());
    if (!stdinError) child.stdin?.end();

    const code = await exitCode;
    if (code !== 0 || stdinError) {
      throw new ExportRendererError(
        `Native Skia renderer exited with ${code}: ${stdinError?.message ?? stderr.slice(-4000)}`,
        "OUTPUT_FAILED",
      );
    }
    const metricLine = stderr.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (!metricLine) throw new ExportRendererError("Native Skia renderer returned no metrics.", "OUTPUT_FAILED");
    let metrics: NativeBackendMetrics;
    try {
      metrics = JSON.parse(metricLine) as NativeBackendMetrics;
    } catch {
      throw new ExportRendererError(`Native Skia renderer returned invalid metrics: ${metricLine.slice(0, 1000)}`, "OUTPUT_FAILED");
    }
    if (!metrics.ok) throw new ExportRendererError(`Native Skia renderer reported failure: ${metricLine.slice(0, 1000)}`, "OUTPUT_FAILED");
    options.onProgress?.({ stage: "rendering", completedFrames: frameCount, totalFrames: frameCount });
    options.onProgress?.({ stage: "encoding", completedFrames: frameCount, totalFrames: frameCount });
    const outputStats = await stat(outputPath);
    return nativeCommandStats(project, outputPath, outputStats.size, evaluateMilliseconds, range, metrics);
  } finally {
    if (child.exitCode === null && !child.killed) child.kill();
  }
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolveExit, reject) => {
    child.once("error", (error) => reject(new Error(`Native Skia renderer failed to start: ${String(error)}`)));
    child.once("close", (code) => resolveExit(code ?? 1));
  });
}

async function writeToNativeStdin(child: ChildProcess, stdinError: Error | undefined, value: Buffer): Promise<void> {
  if (stdinError) throw new ExportRendererError(`Native Skia renderer closed its input: ${stdinError.message}`, "OUTPUT_FAILED");
  const stdin = child.stdin;
  if (!stdin) throw new ExportRendererError("Native Skia renderer stdin is unavailable.", "OUTPUT_FAILED");
  if (stdin.write(value)) return;
  await new Promise<void>((resolveDrain, reject) => {
    const onDrain = () => { stdin.off("error", onError); resolveDrain(); };
    const onError = (error: Error) => { stdin.off("drain", onDrain); reject(error); };
    stdin.once("drain", onDrain);
    stdin.once("error", onError);
  });
}
