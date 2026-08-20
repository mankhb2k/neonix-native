import {
  createPreviewRenderer,
  type PreviewRenderer,
} from "@motionvideo/preview-renderer";
import { compileProjectV1 } from "@motionvideo/motion-runtime/testing";
import {
  evaluateCompositionFrame,
  type EvaluatedFrame,
} from "@motionvideo/motion-runtime";
import type { MotionProject } from "@motionvideo/motion-protocol";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";
import {
  compositionAspectRatio,
  compositionFps,
} from "@/lib/runtime/project-composition";
import type { StageRendererPort } from "./stage-renderer-port";

export type PreviewStageRendererPort = StageRendererPort & {
  readonly preview: PreviewRenderer;
};

export async function createPreviewStageRenderer(
  host: HTMLElement,
): Promise<PreviewStageRendererPort> {
  const canvas = document.createElement("canvas");
  canvas.dataset.testid = "runtime-preview-canvas";
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.transformOrigin = "top left";
  host.style.position = "relative";
  host.appendChild(canvas);

  const preview = await createPreviewRenderer({
    canvas,
    backend: "webgl2",
    width: 1920,
    height: 1080,
  });

  let project: MotionProject | null = null;
  let compiled: MotionRuntimeProject | null = null;
  let lastFrame = 0;
  let lastEvaluated: EvaluatedFrame | null = null;
  let scale = 1;
  let background = "#ffffff";
  let fps = 30;
  let size = { width: 1920, height: 1080 };

  const applyCanvasLayout = () => {
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    canvas.style.transform = `scale(${scale})`;
  };

  const paintEvaluated = (frameIndex: number) => {
    lastFrame = frameIndex;
    if (!project || !compiled) {
      lastEvaluated = null;
      return;
    }
    lastEvaluated = evaluateCompositionFrame(
      compiled,
      frameIndex,
      fps,
      size.width,
      size.height,
      undefined,
      background,
    );
    if (lastEvaluated) preview.paintCommands(lastEvaluated.paint);
  };

  applyCanvasLayout();

  return {
    preview,
    setDocument(input) {
      project = input.project;
      fps = compositionFps(project);
      size = stageSizeForAspect(compositionAspectRatio(project));
      try {
        compiled = compileProjectV1(project);
        delete host.dataset.compileError;
      } catch (error) {
        compiled = null;
        host.dataset.compileError =
          error instanceof Error ? error.message.slice(0, 300) : String(error);
      }
      preview.resize(size.width, size.height, 1);
      applyCanvasLayout();
      paintEvaluated(lastFrame);
    },
    setScale(next) {
      scale = next;
      applyCanvasLayout();
    },
    setBackground(color) {
      background = color;
      paintEvaluated(lastFrame);
    },
    paintFrame(frameIndex) {
      paintEvaluated(frameIndex);
    },
    setPlaying() {
      /* The host clock drives native preview frames directly. */
    },
    syncPlayhead(time) {
      paintEvaluated(Math.round(time * fps));
    },
    getLastEvaluatedFrame() {
      return lastEvaluated;
    },
    dispose() {
      preview.dispose();
      canvas.remove();
      project = null;
      compiled = null;
      lastEvaluated = null;
    },
  };
}
