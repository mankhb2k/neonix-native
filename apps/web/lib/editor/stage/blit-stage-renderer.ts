/**
 * Dual-surface stage: Pixi live (edit/scrub) + worker FrameBuffer blit (play).
 */

import { createPixiStageRenderer } from "@motionvideo/pixi-renderer";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  evaluateCompositionFrame,
  type EvaluatedFrame,
} from "@motionvideo/motion-runtime";
import {
  createPlaybackEngine,
  type FrameBufferEntry,
  type PlaybackEngine,
  type PresentMode,
} from "@motionvideo/playback-engine";
import type { MotionProject } from "@motionvideo/motion-protocol";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";
import {
  compositionAspectRatio,
  compositionFps,
} from "@/lib/runtime/project-composition";
import { createBrowserPreviewWorker } from "@/lib/editor/preview/preview-worker-client";
import type { StageRendererPort } from "@/lib/editor/stage/stage-renderer-port";

export type BlitStageRendererPort = StageRendererPort & {
  setPlaying(playing: boolean): void;
  syncPlayhead(time: number): void;
};

function blitEntry(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  entry: FrameBufferEntry,
): void {
  const frame = entry.data;
  if (frame == null) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frame as CanvasImageSource, 0, 0, canvas.width, canvas.height);
}

export async function createBlitStageRenderer(
  host: HTMLElement,
): Promise<BlitStageRendererPort> {
  host.style.position = "relative";

  const liveLayer = document.createElement("div");
  liveLayer.style.position = "absolute";
  liveLayer.style.inset = "0";
  liveLayer.dataset.testid = "preview-live-layer";
  host.appendChild(liveLayer);

  const blitCanvas = document.createElement("canvas");
  blitCanvas.dataset.testid = "runtime-preview-blit-canvas";
  blitCanvas.style.position = "absolute";
  blitCanvas.style.left = "0";
  blitCanvas.style.top = "0";
  blitCanvas.style.transformOrigin = "top left";
  blitCanvas.style.visibility = "hidden";
  blitCanvas.style.pointerEvents = "none";
  host.appendChild(blitCanvas);
  const blitCtx = blitCanvas.getContext("2d");

  const pixi = createPixiStageRenderer();
  await pixi.mount(liveLayer);
  const pixiCanvas = liveLayer.querySelector("canvas");
  if (pixiCanvas instanceof HTMLCanvasElement) {
    pixiCanvas.dataset.testid = "runtime-preview-canvas";
  }

  const worker = createBrowserPreviewWorker();
  let project: MotionProject | null = null;
  let compiled: MotionRuntimeProject | null = null;
  let lastFrame = 0;
  let lastEvaluated: EvaluatedFrame | null = null;
  let scale = 1;
  let background = "#ffffff";
  let playing = false;
  let fps = 30;

  const applyBlitChrome = (size?: { width: number; height: number }) => {
    if (size) {
      blitCanvas.width = size.width;
      blitCanvas.height = size.height;
    }
    blitCanvas.style.transform = `scale(${scale})`;
  };

  const paintEvaluated = (frameIndex: number) => {
    lastFrame = frameIndex;
    if (!project || !compiled) {
      lastEvaluated = null;
      return;
    }
    const size = stageSizeForAspect(compositionAspectRatio(project));
    const evaluated = evaluateCompositionFrame(
      compiled,
      frameIndex,
      fps,
      size.width,
      size.height,
      undefined,
      background,
    );
    lastEvaluated = evaluated;
    if (evaluated && !playing) pixi.paintFrame(evaluated);
  };

  const setSurfaceMode = (mode: PresentMode) => {
    const buffered = mode === "buffered";
    liveLayer.style.visibility = buffered ? "hidden" : "visible";
    blitCanvas.style.visibility = buffered ? "visible" : "hidden";
    pixi.setTickerEnabled(!buffered);
    host.dataset.previewMode = mode;
    host.dataset.testid = host.dataset.testid || "preview-stage-surfaces";
  };

  const engine: PlaybackEngine = createPlaybackEngine({
    fps,
    clockDrive: "external",
    worker,
    consumer: {
      paintCompositionFrame() {
        /* live path uses pixi.paintFrame directly */
      },
      present(entry) {
        if (blitCtx) blitEntry(blitCtx, blitCanvas, entry);
      },
      onPresentModeChange(mode) {
        setSurfaceMode(mode);
        if (mode === "live") paintEvaluated(lastFrame);
      },
    },
  });

  setSurfaceMode("live");

  return {
    setDocument(input) {
      project = input.project;
      fps = compositionFps(project);
      try {
        compiled = compileMotionProject(input.project);
        delete host.dataset.compileError;
      } catch (err) {
        compiled = null;
        host.dataset.compileError =
          err instanceof Error ? err.message.slice(0, 300) : String(err);
      }
      pixi.setProject(compiled);
      pixi.setBackground(background);
      pixi.setViewport({ scale, offsetX: 0, offsetY: 0 });
      const size = stageSizeForAspect(compositionAspectRatio(project));
      applyBlitChrome(size);
      if (compiled) engine.load(compiled);
      paintEvaluated(lastFrame);
    },
    setScale(next) {
      scale = next;
      pixi.setViewport({ scale, offsetX: 0, offsetY: 0 });
      applyBlitChrome();
    },
    setBackground(color) {
      background = color;
      pixi.setBackground(color);
    },
    paintFrame(frameIndex) {
      lastFrame = frameIndex;
      if (playing) {
        engine.syncPlayhead(frameIndex / Math.max(1, fps));
        return;
      }
      paintEvaluated(frameIndex);
    },
    getLastEvaluatedFrame() {
      return lastEvaluated;
    },
    setPlaying(next) {
      if (!compiled) {
        playing = false;
        return;
      }
      if (next === playing) return;
      playing = next;
      if (next) {
        engine.play();
        engine.syncPlayhead(lastFrame / Math.max(1, fps));
      } else {
        engine.pause();
      }
    },
    syncPlayhead(time) {
      lastFrame = Math.round(time * fps);
      engine.syncPlayhead(time);
    },
    dispose() {
      engine.dispose();
      worker.terminate();
      pixi.dispose();
      blitCanvas.remove();
      liveLayer.remove();
      project = null;
      compiled = null;
      lastEvaluated = null;
    },
  };
}
