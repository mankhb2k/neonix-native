"use client";

import { create } from "zustand";
import type { MotionProject } from "@motionvideo/motion-schema";

export type RenderJobPhase =
  | "idle"
  | "queued"
  | "planning"
  | "rendering"
  | "encoding"
  | "uploading"
  | "ready"
  | "failed"
  | "cancelled";

type RenderJobsState = {
  phase: RenderJobPhase;
  progress: number;
  revisionId: number | null;
  jobId: string | null;
  artifactUrl: string | null;
  error: string | null;
  startExport: (input: {
    projectRevisionId: number;
    format: "mp4";
    project: MotionProject | null;
  }) => Promise<void>;
  cancel: () => void;
  clear: () => void;
};

let cancelToken = 0;
let activeJobId: string | null = null;

function mapStatus(status: string): RenderJobPhase {
  if (status === "queued") return "queued";
  if (status === "planning") return "planning";
  if (status === "rendering") return "rendering";
  if (status === "encoding") return "encoding";
  if (status === "done") return "ready";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "rendering";
}

export const useRenderJobsStore = create<RenderJobsState>((set) => ({
  phase: "idle",
  progress: 0,
  revisionId: null,
  jobId: null,
  artifactUrl: null,
  error: null,
  cancel: () => {
    cancelToken += 1;
    const jobId = activeJobId;
    activeJobId = null;
    if (jobId) {
      void fetch(`/api/renders/${jobId}`, { method: "DELETE" });
    }
    set({ phase: "cancelled", progress: 0 });
  },
  clear: () => {
    activeJobId = null;
    set({
      phase: "idle",
      progress: 0,
      revisionId: null,
      jobId: null,
      artifactUrl: null,
      error: null,
    });
  },
  startExport: async ({ projectRevisionId, format, project }) => {
    const token = ++cancelToken;
    const useMock =
      process.env.NEXT_PUBLIC_EXPORT_MOCK === "1" ||
      process.env.NEXT_PUBLIC_EXPORT_MOCK === "true";

    if (useMock) {
      set({
        phase: "queued",
        progress: 5,
        revisionId: projectRevisionId,
        jobId: null,
        artifactUrl: null,
        error: null,
      });
      for (const step of [
        { phase: "rendering" as const, progress: 45, wait: 200 },
        { phase: "encoding" as const, progress: 80, wait: 150 },
        { phase: "ready" as const, progress: 100, wait: 100 },
      ]) {
        await new Promise((r) => setTimeout(r, step.wait));
        if (token !== cancelToken) return;
        set({ phase: step.phase, progress: step.progress });
      }
      if (token !== cancelToken) return;
      set({
        phase: "ready",
        progress: 100,
        artifactUrl: `mock://export/r${projectRevisionId}.${format}`,
      });
      return;
    }

    if (!project) {
      set({
        phase: "failed",
        progress: 100,
        error: "No project loaded",
        revisionId: projectRevisionId,
      });
      return;
    }

    set({
      phase: "queued",
      progress: 5,
      revisionId: projectRevisionId,
      jobId: null,
      artifactUrl: null,
      error: null,
    });

    try {
      const createRes = await fetch("/api/renders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "web-editor",
        },
        body: JSON.stringify({
          projectId: project.metadata.id,
          projectRevision: projectRevisionId,
          preset: "export-1080p",
          idempotencyKey: `web-editor:${project.metadata.id}:${projectRevisionId}:export-1080p`,
        }),
      });
      const createJson = (await createRes.json()) as {
        jobId?: string;
        status?: string;
        error?: string;
      };
      if (!createRes.ok || !createJson.jobId) {
        throw new Error(createJson.error || `HTTP ${createRes.status}`);
      }
      if (token !== cancelToken) return;

      const jobId = createJson.jobId;
      activeJobId = jobId;
      set({ jobId, phase: "planning", progress: 8 });

      while (token === cancelToken) {
        await new Promise((r) => setTimeout(r, 400));
        if (token !== cancelToken) return;
        const poll = await fetch(`/api/renders/${jobId}`, {
          headers: { "x-user-id": "web-editor" },
        });
        const json = (await poll.json()) as {
          status?: string;
          progress?: number;
          error?: string;
        };
        if (!poll.ok || !json.status) {
          throw new Error(json.error || "Job poll failed");
        }
        const phase = mapStatus(json.status);
        set({
          phase: phase === "ready" ? "uploading" : phase,
          progress: Math.round(Math.min(99, (json.progress ?? 0) * 100)),
          error: json.error ?? null,
        });
        if (json.status === "failed") {
          set({
            phase: "failed",
            progress: 100,
            error: json.error ?? "Export failed",
          });
          return;
        }
        if (json.status === "cancelled") {
          set({ phase: "cancelled", progress: 0 });
          return;
        }
        if (json.status === "done") {
          const downloadRes = await fetch(`/api/renders/${jobId}/download`, {
            headers: { "x-user-id": "web-editor" },
          });
          const downloadJson = (await downloadRes.json()) as { url?: string };
          set({
            phase: "ready",
            progress: 100,
            artifactUrl: downloadJson.url ?? `/api/renders/${jobId}/download`,
          });
          return;
        }
      }
    } catch (error) {
      if (token !== cancelToken) return;
      set({
        phase: "failed",
        progress: 100,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
}));
