/**
 * Editor UI session — zoom/fit/selection/clipboard.
 * Kept out of the document reducer so zoom/selection do not re-render Stage.
 */

import { create } from "zustand";
import {
  clipsContentEndSeconds,
  resolveFitAnchorSeconds,
  selectionNone,
  sliderValueToZoomScale,
  type ClipClipboardItem,
  type EditorSelection,
  type TimelineClip,
} from "@motionvideo/editor-core";

export type TimelineZoomMode = "manual" | "fit";

export type EditorUiPatch = {
  selection?: EditorSelection;
  clipboard?: ClipClipboardItem[];
  timelineZoom?: number;
  timelineZoomScale?: number;
  timelineZoomMode?: TimelineZoomMode;
  timelineFitAnchorSeconds?: number | null;
  timelineFitRevisionBump?: boolean;
};

export type EditorUiSessionState = {
  timelineZoom: number;
  timelineZoomScale: number;
  timelineZoomMode: TimelineZoomMode;
  timelineFitAnchorSeconds: number | null;
  timelineFitRevision: number;
  selection: EditorSelection;
  clipboard: ClipClipboardItem[];
  setZoom: (zoom: number) => void;
  fitTimeline: (clips: readonly TimelineClip[]) => void;
  setSelection: (selection: EditorSelection) => void;
  setClipboard: (clipboard: ClipClipboardItem[]) => void;
  clearClipboard: () => void;
  applyPatch: (patch: EditorUiPatch) => void;
  /** Reset UI when opening a project; optional fit anchor from loaded clips. */
  resetForProject: (fitAnchorSeconds?: number | null) => void;
};

export const useEditorUiSession = create<EditorUiSessionState>((set, get) => ({
  timelineZoom: 50,
  timelineZoomScale: 1,
  timelineZoomMode: "fit",
  timelineFitAnchorSeconds: null,
  timelineFitRevision: 0,
  selection: selectionNone(),
  clipboard: [],

  setZoom: (zoom) => {
    const next = Math.min(100, Math.max(0, zoom));
    set({
      timelineZoom: next,
      timelineZoomScale: sliderValueToZoomScale(next),
      timelineZoomMode: "manual",
    });
  },

  fitTimeline: (clips) => {
    const contentEnd = clipsContentEndSeconds(clips);
    const anchor =
      clips.length <= 1
        ? resolveFitAnchorSeconds(clips)
        : contentEnd > 0
          ? contentEnd / 2
          : null;
    set((s) => ({
      timelineZoom: 50,
      timelineZoomScale: 1,
      timelineZoomMode: "fit",
      timelineFitAnchorSeconds: anchor,
      timelineFitRevision: s.timelineFitRevision + 1,
    }));
  },

  setSelection: (selection) => set({ selection }),

  setClipboard: (clipboard) => set({ clipboard }),

  clearClipboard: () => set({ clipboard: [] }),

  applyPatch: (patch) => {
    set((s) => {
      const next: Partial<EditorUiSessionState> = {};
      if (patch.selection !== undefined) next.selection = patch.selection;
      if (patch.clipboard !== undefined) next.clipboard = patch.clipboard;
      if (patch.timelineZoom !== undefined) next.timelineZoom = patch.timelineZoom;
      if (patch.timelineZoomScale !== undefined) {
        next.timelineZoomScale = patch.timelineZoomScale;
      }
      if (patch.timelineZoomMode !== undefined) {
        next.timelineZoomMode = patch.timelineZoomMode;
      }
      if (patch.timelineFitAnchorSeconds !== undefined) {
        next.timelineFitAnchorSeconds = patch.timelineFitAnchorSeconds;
      }
      if (patch.timelineFitRevisionBump) {
        next.timelineFitRevision = s.timelineFitRevision + 1;
      }
      return next;
    });
  },

  resetForProject: (fitAnchorSeconds = null) => {
    set((s) => ({
      timelineZoom: 50,
      timelineZoomScale: 1,
      timelineZoomMode: "fit",
      timelineFitAnchorSeconds: fitAnchorSeconds,
      timelineFitRevision: s.timelineFitRevision + 1,
      selection: selectionNone(),
      clipboard: [],
    }));
  },
}));

/** Imperative access (gesture / dispatch wrappers). */
export function getEditorUiSession(): EditorUiSessionState {
  return useEditorUiSession.getState();
}
