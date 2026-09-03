import { mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  evaluateRuntimeProjectV3,
  validateRuntimeProjectV3,
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
import type { ExportRenderOptions, ExportRenderStats, RenderedFrame, RuntimeFrameEvaluator } from "./types";

const defaultEvaluator: RuntimeFrameEvaluator = (project, frame) => evaluateRuntimeProjectV3(project, frame);

function defaultAssetRoot(): string {
  const cwd = resolve(process.cwd());
  return basename(cwd).toLowerCase() === "web"
    ? join(cwd, "public")
    : join(cwd, "apps", "web", "public");
}

export async function renderRuntimeProjectV3(
  project: RuntimeProjectV3,
  options: ExportRenderOptions,
  evaluator: RuntimeFrameEvaluator = defaultEvaluator,
): Promise<ExportRenderStats> {
  const validation = validateRuntimeProjectV3(project);
  if (!validation.ok) {
    throw new ExportRendererError("RuntimeProjectV3 validation failed", "INVALID_PROJECT", { diagnostics: validation.diagnostics });
  }
  const { width, height, fps } = project.visual.composition;
  const totalFrames = Math.max(1, Math.ceil((project.visual.composition.duration ?? 1) * fps));
  const frames = Math.max(1, Math.min(options.frameCount ?? totalFrames, totalFrames));
  const renderStarted = performance.now();
  let renderedFrames = 0;
  const assetRoot = options.assetRoot ?? defaultAssetRoot();
  const useSvg = options.renderer === "svg";
  const frameStream = useSvg
    ? (async function* (): AsyncGenerator<Buffer> {
        for (let frame = 0; frame < frames; frame += 1) {
          const commands = evaluator(project, frame);
          const svg = paintCommandsToSvg(commands);
          yield await rasterizeSvgToRgba(svg, width, height);
          renderedFrames += 1;
        }
      })()
    : await createSkiaFrameStream(project, frames, width, height, evaluator, assetRoot, options.ffmpegPath ?? "ffmpeg", () => { renderedFrames += 1; });
  const audioMix = useSvg ? null : resolveProjectAudioMix(project, frames, fps, assetRoot);
  await mkdir(dirname(options.outputPath), { recursive: true });
  const encoded = await encodeRgbaFramesToMp4({
    ffmpegPath: options.ffmpegPath ?? "ffmpeg",
    outputPath: options.outputPath,
    width,
    height,
    fps,
    frames: frameStream,
    ...(audioMix ? { audioInputs: audioMix.inputs, audioFilterComplex: audioMix.filterComplex } : {}),
    durationSeconds: renderedFrames > 0 ? renderedFrames / fps : frames / fps,
    logLevel: options.ffmpegLogLevel,
  });
  return {
    projectId: project.projectId,
    width,
    height,
    fps,
    frames: renderedFrames,
    durationSeconds: renderedFrames / fps,
    outputPath: options.outputPath,
    outputBytes: encoded.outputBytes,
    renderMilliseconds: performance.now() - renderStarted - encoded.encodeMilliseconds,
    encodeMilliseconds: encoded.encodeMilliseconds,
  };
}

async function createSkiaFrameStream(
  project: RuntimeProjectV3,
  frames: number,
  width: number,
  height: number,
  evaluator: RuntimeFrameEvaluator,
  assetRoot: string,
  ffmpegPath: string,
  onFrame: () => void,
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
    onReadback: (pixels) => { readback = Buffer.from(pixels); },
  });
  const assets = new SkiaFrameAssetResolver({ assetRoot, ffmpegPath });
  return (async function* (): AsyncGenerator<Buffer> {
    try {
      for (let frame = 0; frame < frames; frame += 1) {
        const commands = evaluator(project, frame);
        const frameAssets = await assets.resolveFrameAssets(project, commands);
        for (const [assetId, asset] of frameAssets) renderer.setAsset(assetId, asset);
        readback = null;
        renderer.paintCommands(commands);
        if (!readback) {
          throw new ExportRendererError(`Skia did not produce a readback for frame ${frame}.`, "OUTPUT_FAILED", { frame });
        }
        onFrame();
        yield readback;
      }
    } finally {
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
