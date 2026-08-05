"use client";

import { create } from "zustand";

export type RenderJobPhase =
  | "idle"
  | "queued"
  | "rendering"
  | "uploading"
  | "ready"
  | "failed"
  | "cancelled";

type RenderJobsState = {
  phase: RenderJobPhase;
  progress: number;
  revisionId: number | null;
  artifactUrl: string | null;
  error: string | null;
  startExport: (input: { projectRevisionId: number; format: "mp4" }) => Promise<void>;
  cancel: () => void;
  clear: () => void;
};

let cancelToken = 0;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useRenderJobsStore = create<RenderJobsState>((set) => ({
  phase: "idle",
  progress: 0,
  revisionId: null,
  artifactUrl: null,
  error: null,
  cancel: () => {
    cancelToken += 1;
    set({ phase: "cancelled", progress: 0 });
  },
  clear: () =>
    set({
      phase: "idle",
      progress: 0,
      revisionId: null,
      artifactUrl: null,
      error: null,
    }),
  startExport: async ({ projectRevisionId, format }) => {
    const token = ++cancelToken;
    set({
      phase: "queued",
      progress: 5,
      revisionId: projectRevisionId,
      artifactUrl: null,
      error: null,
    });

    const steps: Array<{ phase: RenderJobPhase; progress: number; wait: number }> = [
      { phase: "rendering", progress: 45, wait: 400 },
      { phase: "uploading", progress: 80, wait: 350 },
      { phase: "ready", progress: 100, wait: 200 },
    ];

    for (const step of steps) {
      await sleep(step.wait);
      if (token !== cancelToken) return;
      set({ phase: step.phase, progress: step.progress });
    }

    if (token !== cancelToken) return;
    set({
      phase: "ready",
      progress: 100,
      artifactUrl: `mock://export/r${projectRevisionId}.${format}`,
    });
  },
}));
