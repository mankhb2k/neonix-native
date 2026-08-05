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
      void fetch(`/api/export/jobs/${jobId}`, { method: "DELETE" });
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
      const createRes = await fetch("/api/export/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(project),
      });
      const createJson = (await createRes.json()) as {
        ok?: boolean;
        job?: { jobId: string };
        error?: string;
      };
      if (!createRes.ok || !createJson.job?.jobId) {
        throw new Error(createJson.error || `HTTP ${createRes.status}`);
      }
      if (token !== cancelToken) return;

      const jobId = createJson.job.jobId;
      activeJobId = jobId;
      set({ jobId, phase: "planning", progress: 8 });

      while (token === cancelToken) {
        await new Promise((r) => setTimeout(r, 400));
        if (token !== cancelToken) return;
        const poll = await fetch(`/api/export/jobs/${jobId}`);
        const json = (await poll.json()) as {
          ok?: boolean;
          job?: {
            status: string;
            progress: number;
            error?: string;
            hasArtifact?: boolean;
          };
          error?: string;
        };
        if (!poll.ok || !json.job) {
          throw new Error(json.error || "Job poll failed");
        }
        const phase = mapStatus(json.job.status);
        set({
          phase: phase === "ready" ? "uploading" : phase,
          progress: Math.round(Math.min(99, (json.job.progress ?? 0) * 100)),
          error: json.job.error ?? null,
        });
        if (json.job.status === "failed") {
          set({ phase: "failed", progress: 100, error: json.job.error ?? "Export failed" });
          return;
        }
        if (json.job.status === "cancelled") {
          set({ phase: "cancelled", progress: 0 });
          return;
        }
        if (json.job.status === "done") {
          const artifactUrl = `/api/export/jobs/${jobId}/artifact`;
          set({
            phase: "ready",
            progress: 100,
            artifactUrl: `${artifactUrl}?format=${format}`,
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
