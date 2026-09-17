import {
  evaluateRuntimeProjectV3,
  prepareRuntimeProjectV3,
  type PaintCommandBuffer,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import { ExportRendererError } from "../errors";
import { renderNativeCommandBuffer } from "./native-command";
import { paintCommandsToSvg } from "./svg-rasterizer";
import type { FrameRange } from "./frame-range-scheduler";
import type { ExportRenderOptions, ExportRenderStats, RenderedFrame, RuntimeFrameEvaluator } from "./types";

const defaultEvaluator: RuntimeFrameEvaluator = (project, frame) => evaluateRuntimeProjectV3(project, frame);

/**
 * Production MP4 export entrypoint.
 *
 * CanvasKit is intentionally absent from this path. The command buffer is
 * evaluated once and handed to the native Skia CPU backend, which is the
 * export source of truth. CanvasKit remains available through preview APIs.
 */
export async function renderRuntimeProjectV3(
  project: RuntimeProjectV3,
  options: ExportRenderOptions,
  evaluator: RuntimeFrameEvaluator = defaultEvaluator,
): Promise<ExportRenderStats> {
  if (options.renderer === "svg") {
    throw new ExportRendererError(
      "SVG/CanvasKit export is disabled. MP4 export uses native Skia only; use renderOneFrameToSvg for preview.",
      "UNSUPPORTED_COMMAND",
    );
  }
  let preparedProject;
  try {
    preparedProject = prepareRuntimeProjectV3(project);
  } catch (error) {
    throw new ExportRendererError(
      error instanceof Error ? error.message : "RuntimeProjectV3 validation failed",
      "INVALID_PROJECT",
    );
  }
  const fps = project.visual.composition.fps;
  const totalFrames = Math.max(1, Math.ceil((project.visual.composition.duration ?? 1) * fps));
  const frames = Math.max(1, Math.min(options.frameCount ?? totalFrames, totalFrames));
  const requestedParallelismValue = Number(options.parallelism ?? process.env.EXPORT_RENDERER_PARALLELISM ?? 1);
  const requestedParallelism = Number.isFinite(requestedParallelismValue)
    ? Math.max(1, Math.floor(requestedParallelismValue))
    : 1;

  // Native command-buffer export is deliberately sequential until native
  // assets/audio parity and segment finalization are complete. This avoids a
  // hidden CanvasKit fallback or divergent rendering semantics.
  const stats = await renderFrameRangeToMp4(
    project,
    { ...options, renderer: "skia-native" },
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
      ...(requestedParallelism > 1 ? { fallbackReason: "renderer" as const } : {}),
    },
  };
}

export async function renderFrameRangeToMp4(
  project: RuntimeProjectV3,
  options: ExportRenderOptions,
  range: FrameRange,
  _evaluator: RuntimeFrameEvaluator = defaultEvaluator,
  preparedRuntimeProject?: ReturnType<typeof prepareRuntimeProjectV3>,
): Promise<ExportRenderStats> {
  if (!preparedRuntimeProject) {
    try {
      prepareRuntimeProjectV3(project);
    } catch (error) {
      throw new ExportRendererError(
        error instanceof Error ? error.message : "RuntimeProjectV3 validation failed",
        "INVALID_PROJECT",
      );
    }
  }
  const totalFrames = Math.max(1, Math.ceil((project.visual.composition.duration ?? 1) * project.visual.composition.fps));
  if (!Number.isInteger(range.startFrame) || !Number.isInteger(range.endFrameExclusive)
    || range.startFrame < 0 || range.endFrameExclusive <= range.startFrame
    || range.endFrameExclusive > totalFrames) {
    throw new ExportRendererError("Invalid frame range.", "INVALID_PROJECT", { range, totalFrames });
  }
  if (options.signal?.aborted) throw new ExportRendererError("Render was cancelled.", "CANCELLED");
  return renderNativeCommandBuffer(project, { ...options, renderer: "skia-native" }, range);
}

export function evaluateRuntimeFrame(project: RuntimeProjectV3, frame: number): PaintCommandBuffer {
  return defaultEvaluator(project, frame);
}

/**
 * Preview/diagnostic helper only. It never participates in MP4 export.
 */
export function renderOneFrameToSvg(project: RuntimeProjectV3, frame = 0): RenderedFrame {
  const commands = defaultEvaluator(project, frame);
  return { frame, commands, svg: paintCommandsToSvg(commands) };
}
