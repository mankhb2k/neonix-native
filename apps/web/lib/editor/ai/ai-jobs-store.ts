"use client";

import { create } from "zustand";

export type AiJobPhase =
  | "idle"
  | "queued"
  | "planning"
  | "composing"
  | "validating"
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
  /** Mock command labels for UI diff — real typed commands land with ai-planner wire-up. */
  commandLabels: string[];
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
  }) => Promise<void>;
  cancel: () => void;
  applyProposal: () => AiChangeProposal | null;
  dismissProposal: () => void;
};

let cancelToken = 0;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  startGeneration: async ({ prompt, scope, baseRevision, selectionLabel }) => {
    const token = ++cancelToken;
    set({
      phase: "queued",
      progress: 5,
      error: null,
      proposal: null,
      prompt,
      scope,
    });

    const steps: Array<{ phase: AiJobPhase; progress: number; wait: number }> = [
      { phase: "planning", progress: 25, wait: 350 },
      { phase: "composing", progress: 55, wait: 400 },
      { phase: "validating", progress: 80, wait: 300 },
      { phase: "ready", progress: 100, wait: 150 },
    ];

    for (const step of steps) {
      await sleep(step.wait);
      if (token !== cancelToken) return;
      set({ phase: step.phase, progress: step.progress });
    }

    if (token !== cancelToken) return;

    const target = selectionLabel ?? "project";
    set({
      phase: "ready",
      progress: 100,
      proposal: {
        id: `prop_${Date.now().toString(36)}`,
        baseRevision,
        scope,
        summary: `AI đề xuất chỉnh ${scope} cho ${target}: “${prompt.slice(0, 80)}”`,
        affectedElementKeys:
          scope === "element" && selectionLabel
            ? [selectionLabel]
            : [`scope:${scope}`],
        warnings: [],
        commandLabels: [
          `scope=${scope}`,
          "validate locks",
          "dry-run apply",
          "commit batch",
        ],
      },
    });
  },
}));
