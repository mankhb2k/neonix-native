"use client";

import { useSyncExternalStore } from "react";
import type { StageGuide } from "@motionvideo/editor-core/interactions/stage";

export type StagePreviewCommitState = {
  pending: boolean;
  sourceProject: unknown;
  sequence: number;
};

const EMPTY_GUIDES: readonly StageGuide[] = [];
const EMPTY_COMMIT: StagePreviewCommitState = {
  pending: false,
  sourceProject: null,
  sequence: 0,
};

class StageInteractionStore {
  private guideSnapshot: readonly StageGuide[] = EMPTY_GUIDES;
  private pendingGuides: readonly StageGuide[] | null = null;
  private frame: number | null = null;
  private listeners = new Set<() => void>();
  private commitSnapshot: StagePreviewCommitState = EMPTY_COMMIT;

  getGuides = (): readonly StageGuide[] => this.guideSnapshot;
  getCommitSnapshot = (): StagePreviewCommitState => this.commitSnapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Publish DOM-only guides; authoritative frame state remains in playback. */
  setGuides(guides: readonly StageGuide[] = EMPTY_GUIDES): void {
    this.pendingGuides = guides;
    this.schedulePublish();
  }

  clear(): void {
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
    if (this.pendingGuides === null) return;
    const nextGuides = this.pendingGuides ?? this.guideSnapshot;
    if (nextGuides === this.guideSnapshot) {
      this.pendingGuides = null;
      for (const listener of this.listeners) listener();
      return;
    }
    this.guideSnapshot = nextGuides;
    this.pendingGuides = null;
    for (const listener of this.listeners) listener();
  }
}

export const stageInteractionStore = new StageInteractionStore();

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
