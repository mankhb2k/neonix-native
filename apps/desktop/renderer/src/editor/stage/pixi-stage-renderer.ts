/**
 * N7 Pixi / canvas backend entry.
 * Until Pixi is packaged, delegates to the DOM StageRendererPort so PreviewStage
 * can swap backends without React per-frame paint.
 */

import { createDomStageRenderer, type StageRendererPort } from "./stage-renderer-port";

export type StageRendererBackend = "dom" | "pixi";

/** Active backend — flip after Pixi host lands and fixtures stay under budget. */
export const STAGE_RENDERER_BACKEND: StageRendererBackend = "dom";

export function createStageRenderer(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): StageRendererPort {
  if (backend === "pixi") {
    // Pixi Application host will replace this delegate after N7 soak.
    return createDomStageRenderer(host);
  }
  return createDomStageRenderer(host);
}

/** @deprecated Prefer createStageRenderer */
export function createPixiStageRenderer(host: HTMLElement): StageRendererPort {
  return createStageRenderer(host, "pixi");
}
