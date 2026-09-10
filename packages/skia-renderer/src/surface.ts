import type { SkiaCanvasKit, SkiaSurface } from "./canvas-kit";

export type SkiaSurfaceSelection = {
  surface: SkiaSurface | null;
  directPresentation: boolean;
};

/**
 * Selects the CanvasKit surface for a renderer instance.
 *
 * A canvas-bound surface is an optional presentation optimisation. CanvasKit
 * may reject it at runtime, so callers must use the returned flag rather than
 * assuming that a direct surface was created just because it was requested.
 */
export function createSkiaSurface(
  kit: SkiaCanvasKit,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
  directRequested: boolean,
): SkiaSurfaceSelection {
  if (directRequested && isCanvasSurfaceTarget(canvas)) {
    const directCandidates = [kit.MakeWebGLCanvasSurface, kit.MakeCanvasSurface];
    for (const createDirectSurface of directCandidates) {
      if (!createDirectSurface) continue;
      try {
        // CanvasKit's WebGL surface helpers call other kit methods through
        // `this`; keep the module object as their receiver.
        const surface = createDirectSurface.call(kit, canvas);
        if (surface) return { surface, directPresentation: true };
      } catch {
        // Try the next CanvasKit implementation, then use readback below.
      }
    }
  }
  return { surface: kit.MakeSurface(width, height), directPresentation: false };
}

function isCanvasSurfaceTarget(value: HTMLCanvasElement | OffscreenCanvas): boolean {
  if (typeof HTMLCanvasElement !== "undefined" && value instanceof HTMLCanvasElement) return true;
  return typeof OffscreenCanvas !== "undefined" && value instanceof OffscreenCanvas;
}
