/** Stage renderer factory for web. Native preview is the default GPU surface. */

import {
  createDomStageRenderer,
  type StageRendererBackend,
  type StageRendererPort,
} from "@/lib/editor/stage/stage-renderer-port";
import { createPreviewStageRenderer } from "@/lib/editor/stage/preview-stage-renderer";

export type { StageRendererBackend, StageRendererPort };

function readClientStageOverride(): StageRendererBackend | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search).get("stage");
  if (query === "blit" || query === "preview" || query === "dom") return query;
  try {
    const stored = window.sessionStorage.getItem("MOTICLIP_STAGE_RENDERER");
    if (stored === "blit" || stored === "preview" || stored === "dom") {
      return stored;
    }
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
  return "preview";
}

export const STAGE_RENDERER_BACKEND: StageRendererBackend =
  resolveStageRendererBackend();

export async function createStageRenderer(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): Promise<StageRendererPort> {
  if (backend === "blit") {
    const { createBlitStageRenderer } =
      await import("@/lib/editor/stage/blit-stage-renderer");
    return createBlitStageRenderer(host);
  }
  if (backend === "preview") return createPreviewStageRenderer(host);
  return createDomStageRenderer(host);
}

export function createStageRendererLazy(
  host: HTMLElement,
  backend: StageRendererBackend = STAGE_RENDERER_BACKEND,
): Promise<StageRendererPort> {
  return createStageRenderer(host, backend);
}
