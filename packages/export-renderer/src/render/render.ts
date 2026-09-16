import { mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluatePreparedRuntimeProjectV3,
  evaluateRuntimeProjectV3,
  prepareRuntimeProjectV3,
  type PaintCommandBuffer,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import { createSkiaRenderer } from "@motionvideo/skia-renderer";
import { ExportRendererError } from "../errors";
import { resolveProjectAudioMix } from "./audio-filter";
import { encodeRgbaFramesToMp4 } from "./ffmpeg";
import { createNodeSkiaCanvas, loadNodeCanvasKit } from "./node-skia";
import { SkiaFrameAssetResolver, loadRuntimeFontAssets } from "./skia-assets";
import { paintCommandsToSvg, rasterizeSvgToRgba } from "./svg-rasterizer";
import type { FrameRange } from "./frame-range-scheduler";
import type { ExportRenderOptions, ExportRenderProgress, ExportRenderStats, RenderedFrame, RuntimeFrameEvaluator } from "./types";

const defaultEvaluator: RuntimeFrameEvaluator = (project, frame) => evaluateRuntimeProjectV3(project, frame);

function defaultAssetRoot(): string {
  const configured = process.env.EXPORT_RENDERER_ASSET_ROOT?.trim();
  if (configured) return resolve(configured);
  const cwd = resolve(process.cwd());
  if (basename(cwd).toLowerCase() === "web") return join(cwd, "public");
  if (basename(cwd).toLowerCase() === "neonix") return join(cwd, "apps", "web", "public");
  const packageRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  return join(packageRoot, "..", "..", "apps", "web", "public");
}

export async function renderRuntimeProjectV3(
  project: RuntimeProjectV3,
  options: ExportRenderOptions,
  evaluator: RuntimeFrameEvaluator = defaultEvaluator,
): Promise<ExportRenderStats> {
  let preparedProject;
  try {
    preparedProject = prepareRuntimeProjectV3(project);
  } catch (error) {
    throw new ExportRendererError(
      error instanceof Error ? error.message : "RuntimeProjectV3 validation failed",
      "INVALID_PROJECT",
    );
  }
  const { fps } = project.visual.composition;
  const totalFrames = Math.max(1, Math.ceil((project.visual.composition.duration ?? 1) * fps));
  const frames = Math.max(1, Math.min(options.frameCount ?? totalFrames, totalFrames));
  const requestedParallelismValue = Number(options.parallelism ?? process.env.EXPORT_RENDERER_PARALLELISM ?? 1);
  const requestedParallelism = Number.isFinite(requestedParallelismValue)
    ? Math.max(1, Math.floor(requestedParallelismValue))
    : 1;
  const assetRoot = options.assetRoot ?? defaultAssetRoot();
  const useSvg = options.renderer === "svg";
  const hasAudio = !useSvg && project.audioTimeline.tracks.some((track) => track.clips.length > 0);

  if (requestedParallelism > 1 && evaluator === defaultEvaluator && !useSvg && !hasAudio && frames > 1) {
    const { renderParallelFrameRanges } = await import("./parallel-render");
    return renderParallelFrameRanges(
      project,
      { ...options, assetRoot, parallelism: requestedParallelism },
      { startFrame: 0, endFrameExclusive: frames },
      evaluator,
      preparedProject,
    );
  }

  const stats = await renderFrameRangeToMp4(
    project,
    { ...options, assetRoot },
    { startFrame: 0, endFrameExclusive: frames },
    evaluator,
    preparedProject,
  );
  return {
    ...stats,
    scheduler: {
      strategy: "sequential",
      requestedParallelism,
      actualParallelism: 1,
      chunkSize: frames,
      chunkCount: 1,
      retryCount: 0,
      ...(requestedParallelism > 1 && hasAudio ? { fallbackReason: "audio" as const } : {}),
      ...(requestedParallelism > 1 && useSvg ? { fallbackReason: "renderer" as const } : {}),
    },
  };
}

export async function renderFrameRangeToMp4(
  project: RuntimeProjectV3,
  options: ExportRenderOptions,
  range: FrameRange,
  evaluator: RuntimeFrameEvaluator = defaultEvaluator,
  preparedRuntimeProject?: ReturnType<typeof prepareRuntimeProjectV3>,
): Promise<ExportRenderStats> {
  let preparedProject = preparedRuntimeProject;
  if (!preparedRuntimeProject) {
    try {
      preparedProject = prepareRuntimeProjectV3(project);
    } catch (error) {
      throw new ExportRendererError(
        error instanceof Error ? error.message : "RuntimeProjectV3 validation failed",
        "INVALID_PROJECT",
      );
    }
  }
  if (!preparedProject) throw new ExportRendererError("RuntimeProjectV3 could not be prepared.", "INVALID_PROJECT");
  const frameEvaluator: RuntimeFrameEvaluator = evaluator === defaultEvaluator
    ? (_runtimeProject, frame) => evaluatePreparedRuntimeProjectV3(preparedProject, frame)
    : evaluator;
  const { width, height, fps } = project.visual.composition;
  const frames = range.endFrameExclusive - range.startFrame;
  if (!Number.isInteger(range.startFrame) || !Number.isInteger(range.endFrameExclusive)
    || range.startFrame < 0 || frames < 1) {
    throw new ExportRendererError("Invalid frame range.", "INVALID_PROJECT", { range });
  }
  const renderStarted = performance.now();
  let renderedFrames = 0;
  let frameRenderMilliseconds = 0;
  const renderBreakdown = {
    evaluateMilliseconds: 0,
    assetMilliseconds: 0,
    paintAndReadbackMilliseconds: 0,
    replayMilliseconds: 0,
    flushMilliseconds: 0,
    readbackMilliseconds: 0,
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
    audioPreparationMilliseconds: 0,
  };
  const throwIfCancelled = (): void => {
    if (options.signal?.aborted) throw new ExportRendererError("Render was cancelled.", "CANCELLED");
  };
  const reportProgress = (stage: ExportRenderProgress["stage"]): void => {
    options.onProgress?.({ stage, completedFrames: renderedFrames, totalFrames: frames });
  };
  const assetRoot = options.assetRoot ?? defaultAssetRoot();
  const useSvg = options.renderer === "svg";
  const frameStream = useSvg
      ? (async function* (): AsyncGenerator<Buffer> {
          for (let frame = range.startFrame; frame < range.endFrameExclusive; frame += 1) {
            const frameStartedAt = performance.now();
            throwIfCancelled();
            const evaluateStartedAt = performance.now();
            const commands = frameEvaluator(project, frame);
            renderBreakdown.evaluateMilliseconds += performance.now() - evaluateStartedAt;
            const paintStartedAt = performance.now();
            const svg = paintCommandsToSvg(commands);
            yield await rasterizeSvgToRgba(svg, width, height);
            renderedFrames += 1;
            const frameElapsed = performance.now() - frameStartedAt;
            frameRenderMilliseconds += frameElapsed;
            renderBreakdown.paintAndReadbackMilliseconds += performance.now() - paintStartedAt;
            reportProgress("rendering");
          }
        })()
    : await createSkiaFrameStream(project, range.startFrame, range.endFrameExclusive, width, height, frameEvaluator, assetRoot, options.ffmpegPath ?? "ffmpeg", (timing) => {
      renderedFrames += 1;
      frameRenderMilliseconds += timing.totalMilliseconds;
      renderBreakdown.evaluateMilliseconds += timing.evaluateMilliseconds;
      renderBreakdown.assetMilliseconds += timing.assetMilliseconds;
      renderBreakdown.paintAndReadbackMilliseconds += timing.paintAndReadbackMilliseconds;
      renderBreakdown.replayMilliseconds += timing.replayMilliseconds;
      renderBreakdown.flushMilliseconds += timing.flushMilliseconds;
      renderBreakdown.readbackMilliseconds += timing.readbackMilliseconds;
      renderBreakdown.drawCalls += timing.drawCalls;
      renderBreakdown.textMilliseconds += timing.textMilliseconds;
      renderBreakdown.layerMilliseconds += timing.layerMilliseconds;
      renderBreakdown.endLayerMilliseconds += timing.endLayerMilliseconds;
      renderBreakdown.pathMilliseconds += timing.pathMilliseconds;
      renderBreakdown.shapeMilliseconds += timing.shapeMilliseconds;
      renderBreakdown.offscreenSurfaceCreates += timing.offscreenSurfaceCreates;
      renderBreakdown.offscreenSurfaceReuses += timing.offscreenSurfaceReuses;
      renderBreakdown.filterCacheHits += timing.filterCacheHits;
      renderBreakdown.maskCacheHits += timing.maskCacheHits;
      reportProgress("rendering");
    }, throwIfCancelled, options.onFrameReadback);
  const renderSetupMilliseconds = performance.now() - renderStarted;
  const audioStarted = performance.now();
  const audioMix = useSvg || range.startFrame !== 0 ? null : await resolveProjectAudioMix(project, frames, fps, assetRoot);
  renderBreakdown.audioPreparationMilliseconds += performance.now() - audioStarted;
  await mkdir(dirname(options.outputPath), { recursive: true });
  throwIfCancelled();
  reportProgress("encoding");
  try {
    const encoded = await encodeRgbaFramesToMp4({
      ffmpegPath: options.ffmpegPath ?? "ffmpeg",
      outputPath: options.outputPath,
      width,
      height,
      fps,
      frames: frameStream,
      ...(audioMix ? { audioInputs: audioMix.inputs, audioFilterComplex: audioMix.filterComplex } : {}),
      durationSeconds: renderedFrames > 0 ? renderedFrames / fps : frames / fps,
      preset: options.ffmpegPreset ?? process.env.EXPORT_RENDERER_FFMPEG_PRESET ?? "veryfast",
      ...(options.ffmpegCrf === undefined && !process.env.EXPORT_RENDERER_FFMPEG_CRF
        ? {}
        : { crf: options.ffmpegCrf ?? Number(process.env.EXPORT_RENDERER_FFMPEG_CRF) }),
      ...(options.ffmpegThreads === undefined ? {} : { threads: options.ffmpegThreads }),
      logLevel: options.ffmpegLogLevel,
      signal: options.signal,
    });
    return {
      projectId: project.projectId,
      backendIdentity: {
        requestedBackend: useSvg ? "svg" : "raster",
        actualBackend: useSvg ? "svg-sharp-libvips" : "canvaskit-wasm-raster",
        surfaceKind: useSvg ? "unknown" : "raster",
        softwareRenderer: true,
        ...(useSvg ? { fallbackReason: "legacy_svg_renderer" } : { fallbackReason: "native_skia_gpu_not_implemented" }),
      },
      width,
      height,
      fps,
      frames: renderedFrames,
      durationSeconds: renderedFrames / fps,
      outputPath: options.outputPath,
      outputBytes: encoded.outputBytes,
      renderMilliseconds: renderSetupMilliseconds + frameRenderMilliseconds,
      encodeMilliseconds: Math.max(0, encoded.encodeMilliseconds - frameRenderMilliseconds),
      encodeBreakdown: {
        framesSubmitted: encoded.framesSubmitted,
        pipeWriteMilliseconds: encoded.pipeWriteMilliseconds,
        backpressureWaitMilliseconds: encoded.backpressureWaitMilliseconds,
        finalizeMilliseconds: encoded.finalizeMilliseconds,
      },
      renderBreakdown,
    };
  } finally {
    await audioMix?.cleanup?.();
  }
}

async function createSkiaFrameStream(
  project: RuntimeProjectV3,
  startFrame: number,
  endFrameExclusive: number,
  width: number,
  height: number,
  evaluator: RuntimeFrameEvaluator,
  assetRoot: string,
  ffmpegPath: string,
  onFrame: (timing: { totalMilliseconds: number; evaluateMilliseconds: number; assetMilliseconds: number; paintAndReadbackMilliseconds: number; replayMilliseconds: number; flushMilliseconds: number; readbackMilliseconds: number; drawCalls: number; textMilliseconds: number; layerMilliseconds: number; endLayerMilliseconds: number; pathMilliseconds: number; shapeMilliseconds: number; offscreenSurfaceCreates: number; offscreenSurfaceReuses: number; filterCacheHits: number; maskCacheHits: number }) => void,
  throwIfCancelled: () => void,
  onFrameReadback?: (pixels: Uint8Array, frame: number) => void,
): Promise<AsyncGenerator<Buffer>> {
  const kit = await loadNodeCanvasKit();
  const canvas = createNodeSkiaCanvas();
  let readback: Buffer | null = null;
  const fonts = await loadRuntimeFontAssets(project, assetRoot);
  const renderer = await createSkiaRenderer({
    canvas: canvas as HTMLCanvasElement,
    width,
    height,
    devicePixelRatio: 1,
    canvasKit: kit,
    fonts,
    // CanvasKit's readPixels result is consumed before the next frame is
    // painted. Reuse its backing ArrayBuffer instead of copying ~8MB/frame.
    onReadback: (pixels) => { readback = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength); },
  });
  const assets = new SkiaFrameAssetResolver({ assetRoot, ffmpegPath });
  return (async function* (): AsyncGenerator<Buffer> {
    try {
      for (let frame = startFrame; frame < endFrameExclusive; frame += 1) {
        const frameStartedAt = performance.now();
        throwIfCancelled();
        const evaluateStartedAt = performance.now();
        const commands = evaluator(project, frame);
        const evaluateMilliseconds = performance.now() - evaluateStartedAt;
        const assetStartedAt = performance.now();
        const frameAssets = await assets.resolveFrameAssets(project, commands);
        const assetMilliseconds = performance.now() - assetStartedAt;
        for (const [assetId, asset] of frameAssets) renderer.setAsset(assetId, asset);
        readback = null;
        const paintStartedAt = performance.now();
        renderer.paintCommands(commands);
        const paintAndReadbackMilliseconds = performance.now() - paintStartedAt;
        if (!readback) {
          throw new ExportRendererError(`Skia did not produce a readback for frame ${frame}.`, "OUTPUT_FAILED", { frame });
        }
        onFrameReadback?.(readback, frame);
        onFrame({
          totalMilliseconds: performance.now() - frameStartedAt,
          evaluateMilliseconds,
          assetMilliseconds,
          paintAndReadbackMilliseconds,
          replayMilliseconds: renderer.getStats().replayTimeMs,
          flushMilliseconds: renderer.getStats().flushTimeMs,
          readbackMilliseconds: renderer.getStats().readbackTimeMs,
          drawCalls: renderer.getStats().drawCalls,
          textMilliseconds: renderer.getStats().textTimeMs,
          layerMilliseconds: renderer.getStats().layerTimeMs,
          endLayerMilliseconds: renderer.getStats().endLayerTimeMs,
          pathMilliseconds: renderer.getStats().pathTimeMs,
          shapeMilliseconds: renderer.getStats().shapeTimeMs,
          offscreenSurfaceCreates: renderer.getStats().offscreenSurfaceCreates,
          offscreenSurfaceReuses: renderer.getStats().offscreenSurfaceReuses,
          filterCacheHits: renderer.getStats().filterCacheHits,
          maskCacheHits: renderer.getStats().maskCacheHits,
        });
        yield readback;
      }
    } finally {
      assets.dispose();
      renderer.dispose();
    }
  })();
}

export function evaluateRuntimeFrame(project: RuntimeProjectV3, frame: number): PaintCommandBuffer {
  return defaultEvaluator(project, frame);
}

export function renderOneFrameToSvg(project: RuntimeProjectV3, frame = 0): RenderedFrame {
  const commands = defaultEvaluator(project, frame);
  return { frame, commands, svg: paintCommandsToSvg(commands) };
}
