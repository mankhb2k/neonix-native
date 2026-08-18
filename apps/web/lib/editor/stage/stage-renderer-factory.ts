/**
 * Stage renderer factory for web (desktop-inspired — no desktop imports).
 * Pixi path: compile once → evaluateCompositionFrame once per tick → paint EvaluatedFrame.
 */

import {
  createDomStageRenderer,
  type StageRendererBackend,
  type StageRendererPort,
} from "@/lib/editor/stage/stage-renderer-port";
import { createPixiStageRenderer } from "@motionvideo/pixi-renderer";
import { compileProjectV1 } from "@motionvideo/motion-runtime/testing";
import {
  evaluateCompositionFrame,
  type EvaluatedFrame,
} from "@motionvideo/motion-runtime";
import type {
  MotionProject,
} from "@motionvideo/motion-protocol";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";
import {
  compositionAspectRatio,
  compositionFps,
} from "@/lib/runtime/project-composition";

export type { StageRendererBackend, StageRendererPort };

function readClientStageOverride(): StageRendererBackend | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search).get("stage");
  if (query === "blit" || query === "pixi" || query === "dom") return query;
  try {
    const stored = window.sessionStorage.getItem("MOTICLIP_STAGE_RENDERER");
    if (stored === "blit" || stored === "pixi" || stored === "dom") return stored;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveStageRendererBackend(): StageRendererBackend {
  const client = readClientStageOverride();
  if (client) return client;
  const raw = process.env.NEXT_PUBLIC_STAGE_RENDERER?.toLowerCase();
  if (raw === "dom") return "dom";
  if (raw === "blit") return "blit";
  return "pixi";
}

export const STAGE_RENDERER_BACKEND: StageRendererBackend =
  resolveStageRendererBackend();

/** Mount-aware factory: Pixi needs async mount onto host. */
export async function createStageRenderer(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): Promise<StageRendererPort> {
  if (backend === "blit") {
    const { createBlitStageRenderer } = await import(
      "@/lib/editor/stage/blit-stage-renderer"
    );
    return createBlitStageRenderer(host);
  }
  if (backend === "pixi") {
    const pixi = createPixiStageRenderer();
    await pixi.mount(host);
    let project: MotionProject | null = null;
    let compiled: MotionRuntimeProject | null = null;
    let lastFrame = 0;
    let lastEvaluated: EvaluatedFrame | null = null;
    let scale = 1;
    let background = "#ffffff";

    const paintEvaluated = (frameIndex: number) => {
      lastFrame = frameIndex;
      if (!project || !compiled) {
        lastEvaluated = null;
        return;
      }
      const fps = compositionFps(project);
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
      if (evaluated) pixi.paintFrame(evaluated);
    };

    return {
      setDocument(input) {
        project = input.project;
        try {
          compiled = compileProjectV1(input.project);
        } catch (error) {
          compiled = null;
          console.warn(
            "[stage] compileProjectV1 failed",
            error instanceof Error ? error.message : error,
          );
        }
        pixi.setProject(compiled);
        pixi.setBackground(background);
        pixi.setViewport({ scale, offsetX: 0, offsetY: 0 });
        paintEvaluated(lastFrame);
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
        paintEvaluated(frameIndex);
      },
      getLastEvaluatedFrame() {
        return lastEvaluated;
      },
      dispose() {
        pixi.dispose();
        project = null;
        compiled = null;
        lastEvaluated = null;
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
