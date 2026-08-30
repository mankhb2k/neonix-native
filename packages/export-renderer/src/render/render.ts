import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  evaluateRuntimeProjectV3,
  validateRuntimeProjectV3,
  type PaintCommandBuffer,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import { ExportRendererError } from "../errors";
import { encodeRgbaFramesToMp4 } from "./ffmpeg";
import { paintCommandsToSvg, rasterizeSvgToRgba } from "./svg-rasterizer";
import type { ExportRenderOptions, ExportRenderStats, RenderedFrame, RuntimeFrameEvaluator } from "./types";

const defaultEvaluator: RuntimeFrameEvaluator = (project, frame) => evaluateRuntimeProjectV3(project, frame);

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
  const frames = Math.min(options.frameCount ?? totalFrames, totalFrames);
  const renderStarted = performance.now();
  let renderedFrames = 0;
  const frameStream = async function* (): AsyncGenerator<Buffer> {
    for (let frame = 0; frame < frames; frame += 1) {
      const commands = evaluator(project, frame);
      const svg = paintCommandsToSvg(commands);
      yield await rasterizeSvgToRgba(svg, width, height);
      renderedFrames += 1;
    }
  };
  await mkdir(dirname(options.outputPath), { recursive: true });
  const encoded = await encodeRgbaFramesToMp4({
    ffmpegPath: options.ffmpegPath ?? "ffmpeg",
    outputPath: options.outputPath,
    width,
    height,
    fps,
    frames: frameStream(),
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

export function evaluateRuntimeFrame(project: RuntimeProjectV3, frame: number): PaintCommandBuffer {
  return defaultEvaluator(project, frame);
}

export function renderOneFrameToSvg(project: RuntimeProjectV3, frame = 0): RenderedFrame {
  const commands = defaultEvaluator(project, frame);
  return { frame, commands, svg: paintCommandsToSvg(commands) };
}
