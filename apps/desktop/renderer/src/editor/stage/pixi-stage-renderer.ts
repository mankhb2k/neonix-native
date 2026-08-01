/**
 * Stage renderer factory — DOM default; Canvas2D as `canvas-experimental` (P21).
 * `"pixi"` remains a deprecated alias of canvas-experimental.
 */

import {
  createDomStageRenderer,
  type StageRendererPort,
} from "./stage-renderer-port";

export type StageRendererBackend = "dom" | "canvas-experimental" | "pixi";

/** Active backend — DOM default until canvas-experimental contract + soak. */
export const STAGE_RENDERER_BACKEND: StageRendererBackend = "dom";

function resolveBackend(
  backend: StageRendererBackend,
): "dom" | "canvas-experimental" {
  if (backend === "pixi" || backend === "canvas-experimental") {
    return "canvas-experimental";
  }
  return "dom";
}

export function createStageRenderer(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): StageRendererPort {
  if (resolveBackend(backend) === "canvas-experimental") {
    // Sync callers stay on DOM; use createStageRendererLazy for experimental.
    return createDomStageRenderer(host);
  }
  return createDomStageRenderer(host);
}

/** Code-split canvas-experimental seam. */
export async function createStageRendererLazy(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): Promise<StageRendererPort> {
  if (resolveBackend(backend) === "canvas-experimental") {
    const { createCanvasStageRenderer } = await import("./canvas-stage-renderer");
    return createCanvasStageRenderer(host);
  }
  return createDomStageRenderer(host);
}

/** Prefetch canvas-experimental chunk (idle after editor mount). */
export function prefetchPixiStageRenderer(): void {
  void import("./canvas-stage-renderer");
}

/** @deprecated Prefer createStageRendererLazy(..., "canvas-experimental") */
export function createPixiStageRenderer(host: HTMLElement): StageRendererPort {
  return createStageRenderer(host, "canvas-experimental");
}
