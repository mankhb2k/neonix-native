/**
 * Stage renderer factory — DOM default; Canvas2D behind the Pixi seam (P17).
 * `createStageRendererLazy` / `prefetchPixiStageRenderer` code-split the canvas chunk.
 */

import {
  createDomStageRenderer,
  type StageRendererPort,
} from "./stage-renderer-port";

export type StageRendererBackend = "dom" | "pixi";

/** Active backend — DOM default until Canvas/Pixi soak completes. */
export const STAGE_RENDERER_BACKEND: StageRendererBackend = "dom";

export function createStageRenderer(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): StageRendererPort {
  if (backend === "pixi") {
    // Sync callers stay on DOM; flip via createStageRendererLazy + backend "pixi".
    return createDomStageRenderer(host);
  }
  return createDomStageRenderer(host);
}

/** Code-split canvas/Pixi seam. */
export async function createStageRendererLazy(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): Promise<StageRendererPort> {
  if (backend === "pixi") {
    const { createCanvasStageRenderer } = await import("./canvas-stage-renderer");
    return createCanvasStageRenderer(host);
  }
  return createDomStageRenderer(host);
}

/** Prefetch canvas chunk (idle after editor mount). */
export function prefetchPixiStageRenderer(): void {
  void import("./canvas-stage-renderer");
}

/** @deprecated Prefer createStageRendererLazy(..., "pixi") */
export function createPixiStageRenderer(host: HTMLElement): StageRendererPort {
  return createStageRenderer(host, "pixi");
}
