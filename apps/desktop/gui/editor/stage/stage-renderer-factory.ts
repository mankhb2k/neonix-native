/**
 * Stage renderer factory — production default is DOM.
 * Canvas2D is opt-in via `canvas-experimental` only (Logic-4).
 * The historical `"pixi"` name is rejected — no PixiJS runtime in this app.
 */

import {
  createDomStageRenderer,
  type StageRendererPort,
} from "./stage-renderer-port";

export type StageRendererBackend = "dom" | "canvas-experimental";

/** Active backend — DOM is the production preview path. */
export const STAGE_RENDERER_BACKEND: StageRendererBackend = "dom";

/** Normalize legacy aliases; `"pixi"` maps to canvas-experimental with a warning. */
export function resolveStageBackend(
  backend: string | undefined = STAGE_RENDERER_BACKEND,
): StageRendererBackend {
  if (backend === "canvas-experimental" || backend === "pixi") {
    if (backend === "pixi" && typeof console !== "undefined") {
      // eslint-disable-next-line no-console -- intentional deprecation signal
      console.warn(
        '[stage] backend "pixi" is deprecated; use "canvas-experimental". No PixiJS runtime is loaded.',
      );
    }
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
  backend: StageRendererBackend | string = STAGE_RENDERER_BACKEND,
): StageRendererPort {
  if (resolveStageBackend(backend) !== "dom") {
    throw new Error(
      'createStageRenderer sync only supports "dom"; use createStageRendererLazy(host, "canvas-experimental") for canvas-experimental.',
    );
  }
  return createDomStageRenderer(host);
}

/** Code-split canvas-experimental seam. */
export async function createStageRendererLazy(
  host: HTMLElement,
  backend: StageRendererBackend | string = STAGE_RENDERER_BACKEND,
): Promise<StageRendererPort> {
  if (resolveStageBackend(backend) === "canvas-experimental") {
    const { createCanvasStageRenderer } = await import("./canvas-stage-renderer");
    return createCanvasStageRenderer(host);
  }
  return createDomStageRenderer(host);
}

/** Prefetch canvas-experimental chunk (idle after editor mount). */
export function prefetchCanvasStageRenderer(): void {
  void import("./canvas-stage-renderer");
}

/** @deprecated Use {@link prefetchCanvasStageRenderer} */
export function prefetchPixiStageRenderer(): void {
  prefetchCanvasStageRenderer();
}

/** @deprecated Prefer createStageRendererLazy(..., "canvas-experimental") */
export function createPixiStageRenderer(_host: HTMLElement): never {
  throw new Error(
    'createPixiStageRenderer is removed; use createStageRendererLazy(host, "canvas-experimental"). No PixiJS runtime exists.',
  );
}
