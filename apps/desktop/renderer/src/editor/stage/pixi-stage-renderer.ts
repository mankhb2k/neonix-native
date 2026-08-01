/**
 * N7 Pixi / canvas backend entry.
 * Pixi is post-DOM-baseline: land after DomStageRenderer cache/diff (G2) proves
 * the StageRendererPort contract under fixture load. Until then, always delegate
 * to createDomStageRenderer so PreviewStage keeps DOM as the default backend.
 */

import { createDomStageRenderer, type StageRendererPort } from "./stage-renderer-port";

export type StageRendererBackend = "dom" | "pixi";

/** Active backend — DOM default; flip to pixi only after Pixi host + soak. */
export const STAGE_RENDERER_BACKEND: StageRendererBackend = "dom";

export function createStageRenderer(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): StageRendererPort {
  if (backend === "pixi") {
    // Post-DOM-baseline: Pixi Application host replaces this delegate later.
    return createDomStageRenderer(host);
  }
  return createDomStageRenderer(host);
}

/** @deprecated Prefer createStageRenderer */
export function createPixiStageRenderer(host: HTMLElement): StageRendererPort {
  return createStageRenderer(host, "pixi");
}
