"use client";

import { useSyncExternalStore } from "react";
import type { StageGuide } from "@motionvideo/editor-core/interactions/stage";

export type StagePreviewOverride = {
  /** Composition-space translation applied after the evaluated layer matrix. */
  translateDelta: { x: number; y: number };
  /** Optional transient scale multiplier used by auto-sized text resize. */
  scaleMultiplier?: { x: number; y: number };
  /** Composition-space origin for the transient scale. */
  scaleOrigin?: { x: number; y: number };
};

export type StagePreviewOverrides = ReadonlyMap<string, StagePreviewOverride>;

export type StagePreviewCommitState = {
  pending: boolean;
  sourceProject: unknown;
  sequence: number;
};

const EMPTY_PREVIEW: StagePreviewOverrides = new Map();
const EMPTY_GUIDES: readonly StageGuide[] = [];
const EMPTY_COMMIT: StagePreviewCommitState = {
  pending: false,
  sourceProject: null,
  sequence: 0,
};

class StageInteractionStore {
  private snapshot: StagePreviewOverrides = EMPTY_PREVIEW;
  private guideSnapshot: readonly StageGuide[] = EMPTY_GUIDES;
  private pending: StagePreviewOverrides | null = null;
  private pendingGuides: readonly StageGuide[] | null = null;
  private frame: number | null = null;
  private listeners = new Set<() => void>();
  private commitSnapshot: StagePreviewCommitState = EMPTY_COMMIT;

  getSnapshot = (): StagePreviewOverrides => this.snapshot;
  getGuides = (): readonly StageGuide[] => this.guideSnapshot;
  getCommitSnapshot = (): StagePreviewCommitState => this.commitSnapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setPreview(next: StagePreviewOverrides, guides: readonly StageGuide[] = EMPTY_GUIDES): void {
    this.pending = next;
    this.pendingGuides = guides;
    this.schedulePublish();
  }

  clear(): void {
    this.pending = EMPTY_PREVIEW;
    this.pendingGuides = EMPTY_GUIDES;
    if (this.frame !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.publish();
  }

  /** Keep the transient transform alive while the canonical project commits. */
  beginCommit(sourceProject: unknown): void {
    this.commitSnapshot = {
      pending: true,
      sourceProject,
      sequence: this.commitSnapshot.sequence + 1,
    };
    for (const listener of this.listeners) listener();
  }

  isCommitPendingFor(project: unknown): boolean {
    return this.commitSnapshot.pending && this.commitSnapshot.sourceProject !== project;
  }

  /** Clear the transient transform only after the new project has been painted. */
  acknowledgeCommit(project: unknown): void {
    if (!this.isCommitPendingFor(project)) return;
    this.commitSnapshot = {
      pending: false,
      sourceProject: null,
      sequence: this.commitSnapshot.sequence + 1,
    };
    this.clear();
  }

  cancelCommit(): void {
    if (!this.commitSnapshot.pending) return;
    this.commitSnapshot = {
      pending: false,
      sourceProject: null,
      sequence: this.commitSnapshot.sequence + 1,
    };
    this.clear();
  }

  private schedulePublish(): void {
    if (this.frame !== null) return;
    if (typeof window === "undefined") {
      this.publish();
      return;
    }
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.publish();
    });
  }

  private publish(): void {
    if (this.pending === null && this.pendingGuides === null) return;
    const next = this.pending ?? this.snapshot;
    const nextGuides = this.pendingGuides ?? this.guideSnapshot;
    if (next === this.snapshot && nextGuides === this.guideSnapshot) {
      this.pending = null;
      this.pendingGuides = null;
      for (const listener of this.listeners) listener();
      return;
    }
    this.snapshot = next;
    this.guideSnapshot = nextGuides;
    this.pending = null;
    this.pendingGuides = null;
    for (const listener of this.listeners) listener();
  }
}

export const stageInteractionStore = new StageInteractionStore();

export function useStagePreviewOverrides(): StagePreviewOverrides {
  return useSyncExternalStore(
    stageInteractionStore.subscribe,
    stageInteractionStore.getSnapshot,
    stageInteractionStore.getSnapshot,
  );
}

export function useStageSnapGuides(): readonly StageGuide[] {
  return useSyncExternalStore(
    stageInteractionStore.subscribe,
    stageInteractionStore.getGuides,
    stageInteractionStore.getGuides,
  );
}

export function useStagePreviewCommit(): StagePreviewCommitState {
  return useSyncExternalStore(
    stageInteractionStore.subscribe,
    stageInteractionStore.getCommitSnapshot,
    stageInteractionStore.getCommitSnapshot,
  );
}
