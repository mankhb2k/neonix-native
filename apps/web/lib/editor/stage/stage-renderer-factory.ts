/**
 * Stage renderer factory for web (desktop-inspired — no desktop imports).
 */

import {
  createDomStageRenderer,
  type StageRendererBackend,
  type StageRendererPort,
} from "@/lib/editor/stage/stage-renderer-port";
import { createPixiStageRenderer } from "@motionvideo/pixi-renderer";
import type { MotionProject } from "@motionvideo/motion-schema";

export function resolveStageRendererBackend(): StageRendererBackend {
  const raw = process.env.NEXT_PUBLIC_STAGE_RENDERER?.toLowerCase();
  if (raw === "dom") return "dom";
  // pixi is default; remotion is handled outside this factory
  return "pixi";
}

export const STAGE_RENDERER_BACKEND: StageRendererBackend =
  resolveStageRendererBackend();

/** Mount-aware factory: Pixi needs async mount onto host. */
export async function createStageRenderer(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): Promise<StageRendererPort> {
  if (backend === "pixi") {
    const pixi = createPixiStageRenderer();
    await pixi.mount(host);
    let project: MotionProject | null = null;
    let lastFrame = 0;
    let scale = 1;
    let background = "#ffffff";

    return {
      setDocument(input) {
        project = input.project;
        pixi.setAuthoringProject(input.project);
        pixi.setBackground(background);
        pixi.setViewport({ scale, offsetX: 0, offsetY: 0 });
        pixi.paintFrame(lastFrame);
      },
      setScale(next) {
        scale = next;
        pixi.setViewport({ scale, offsetX: 0, offsetY: 0 });
      },
      setBackground(color) {
        background = color;
        pixi.setBackground(color);
      },
      paintFrame(frameIndex) {
        lastFrame = frameIndex;
        if (!project) return;
        pixi.paintFrame(frameIndex);
      },
      getLastEvaluatedFrame() {
        return null;
      },
      dispose() {
        pixi.dispose();
        project = null;
      },
    };
  }
  return createDomStageRenderer(host);
}

export function createStageRendererLazy(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): Promise<StageRendererPort> {
  return createStageRenderer(host, backend);
}
