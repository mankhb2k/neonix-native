"use client";

import { create } from "zustand";
import type { MotionProject } from "@motionvideo/motion-protocol";

export type AiJobPhase =
  | "idle"
  | "queued"
  | "planning"
  | "composing"
  | "validating"
  | "repairing"
  | "ready"
  | "failed";

export type RegenerationScope =
  | "video"
  | "scene"
  | "element"
  | "content"
  | "layout"
  | "style"
  | "motion"
  | "timing";

export type AiChangeProposal = {
  id: string;
  baseRevision: number;
  scope: RegenerationScope;
  summary: string;
  affectedElementKeys: string[];
  warnings: string[];
  commandLabels: string[];
  /** Full project replace (generate) or patched project (refine). */
  project?: MotionProject | null;
  revision?: number;
  generation?: {
    planId: string;
    seed: string;
    model: string;
    capabilityManifestVersion: string;
    criticScore?: number;
    warnings?: string[];
  };
};

type AiJobsState = {
  phase: AiJobPhase;
  scope: RegenerationScope;
  prompt: string;
  progress: number;
  error: string | null;
  proposal: AiChangeProposal | null;
  setScope: (scope: RegenerationScope) => void;
  setPrompt: (prompt: string) => void;
  startGeneration: (input: {
    prompt: string;
    scope: RegenerationScope;
    baseRevision: number;
    selectionLabel?: string;
    project?: MotionProject | null;
  }) => Promise<void>;
  cancel: () => void;
  applyProposal: () => AiChangeProposal | null;
  dismissProposal: () => void;
};

let cancelToken = 0;

function mapPhase(phase: string): AiJobPhase {
  if (
    phase === "queued" ||
    phase === "planning" ||
    phase === "composing" ||
    phase === "validating" ||
    phase === "repairing" ||
    phase === "ready" ||
    phase === "failed"
  ) {
    return phase;
  }
  if (phase === "designing") return "planning";
  if (phase === "probing") return "validating";
  return "composing";
}

async function readSse(
  response: Response,
  onPhase: (phase: AiJobPhase, progress: number) => void,
): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Record<string, unknown> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (event === "phase") {
        onPhase(mapPhase(String(parsed.phase ?? "composing")), Number(parsed.progress ?? 50));
      }
      if (event === "result") result = parsed;
      if (event === "error") throw new Error(String(parsed.error ?? "generation failed"));
    }
  }
  return result;
}

export const useAiJobsStore = create<AiJobsState>((set, get) => ({
  phase: "idle",
  scope: "video",
  prompt: "",
  progress: 0,
  error: null,
  proposal: null,
  setScope: (scope) => set({ scope }),
  setPrompt: (prompt) => set({ prompt }),
  cancel: () => {
    cancelToken += 1;
    set({ phase: "idle", progress: 0, error: null });
  },
  dismissProposal: () => set({ proposal: null, phase: "idle", progress: 0 }),
  applyProposal: () => {
    const proposal = get().proposal;
    set({ proposal: null, phase: "idle", progress: 0, prompt: "" });
    return proposal;
  },
  startGeneration: async ({ prompt, scope, baseRevision, selectionLabel, project }) => {
    const token = ++cancelToken;
    set({
      phase: "queued",
      progress: 5,
      error: null,
      proposal: null,
      prompt,
      scope,
    });

    try {
      const isRefine = scope !== "video" && Boolean(project);
      const response = await fetch("/api/ai/generations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isRefine
            ? {
                mode: "refine",
                prompt,
                scope,
                baseRevision,
                selectionKey: selectionLabel,
                project,
                stream: false,
              }
            : {
                mode: "generate",
                prompt,
                seed: `web_${baseRevision}_${Date.now().toString(36)}`,
                baseRevision,
                stream: true,
                probeFrames: false,
              },
        ),
      });

      if (token !== cancelToken) return;

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      if (isRefine) {
        set({ phase: "validating", progress: 70 });
        const json = (await response.json()) as {
          ok?: boolean;
          proposal?: AiChangeProposal;
          error?: string;
        };
        if (token !== cancelToken) return;
        if (!json.proposal) throw new Error(json.error || "No refine proposal");
        set({
          phase: "ready",
          progress: 100,
          proposal: {
            ...json.proposal,
            scope,
            baseRevision,
          },
        });
        return;
      }

      const result = await readSse(response, (phase, progress) => {
        if (token !== cancelToken) return;
        set({ phase, progress });
      });
      if (token !== cancelToken) return;

      const proposal = result.proposal as AiChangeProposal | null | undefined;
      if (!proposal?.project) {
        throw new Error(String(result.error ?? "Generation produced no project"));
      }

      const critic = result.critic as
        | { score?: number; findings?: Array<{ message?: string }> }
        | undefined;
      const baseGeneration =
        (result.generation as AiChangeProposal["generation"]) ?? proposal.generation;
      const warningList =
        proposal.warnings?.length
          ? proposal.warnings
          : (critic?.findings ?? [])
              .map((f) => f.message)
              .filter((m): m is string => Boolean(m));

      set({
        phase: "ready",
        progress: 100,
        proposal: {
          ...proposal,
          baseRevision,
          warnings: warningList,
          generation: baseGeneration
            ? {
                ...baseGeneration,
                ...(critic?.score != null ? { criticScore: critic.score } : {}),
                ...(warningList.length ? { warnings: warningList } : {}),
              }
            : undefined,
        },
      });
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
