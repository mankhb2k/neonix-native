/**
 * Stage renderer factory — DOM default; Canvas2D as `canvas-experimental` (P21/B4).
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

/**
 * Sync factory — DOM only. Experimental backends must use
 * {@link createStageRendererLazy}.
 */
export function createStageRenderer(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): StageRendererPort {
  if (resolveBackend(backend) !== "dom") {
    throw new Error(
      `createStageRenderer sync only supports "dom"; use createStageRendererLazy(host, "${backend === "pixi" ? "canvas-experimental" : backend}") for canvas-experimental.`,
    );
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
export function createPixiStageRenderer(_host: HTMLElement): never {
  throw new Error(
    'createPixiStageRenderer is deprecated; use createStageRendererLazy(host, "canvas-experimental").',
  );
}
