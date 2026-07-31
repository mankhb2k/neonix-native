"use client";

import { create } from "zustand";
import { createClipActions } from "@/lib/editor/store/actions/clip-actions";
import { createClipboardActions } from "@/lib/editor/store/actions/clipboard-actions";
import { createDocumentActions } from "@/lib/editor/store/actions/document-actions";
import { createLaneActions } from "@/lib/editor/store/actions/lane-actions";
import { createProjectLifecycleActions } from "@/lib/editor/store/actions/project-lifecycle-actions";
import { createSelectionActions } from "@/lib/editor/store/actions/selection-actions";
import { createUiActions } from "@/lib/editor/store/actions/ui-actions";
import { createInitialEditorState } from "@/lib/editor/store/initial-state";
import type { EditorStore } from "@/lib/editor/store/types";

import { documentFromStoreState } from "@/lib/editor/timeline/document";
import { executeTimelineCommand } from "@/lib/editor/timeline/commands/command-runner";

export function createEditorStore(initialState?: Partial<EditorStore>) {
  return create<EditorStore>((set, get) => ({
    ...createInitialEditorState(),
    ...initialState,
    executeTimelineCommand: (command) => {
      const state = get();
      const doc = documentFromStoreState(state);
      if (!doc) {
        return {
          status: "rejected",
          reason: "no_project",
          message: "Project chưa được nạp vào store.",
        };
      }
      const wasEmpty = state.timelineClips.length === 0;
      const result = executeTimelineCommand(
        doc,
        command,
        state.selection,
        state.timelineClipboard ?? [],
      );
      if (result.status === "applied") {
        const isEmptyNow = result.document.clips.length === 0;
        const addedFirstClip = wasEmpty && !isEmptyNow;
        const firstClip = result.document.clips[0];

        set({
          project: result.document.project,
          timelineLanes: result.document.lanes,
          timelineClips: result.document.clips,
          ...(result.selection ? { selection: result.selection } : {}),
          ...(isEmptyNow
            ? {
                timelineFitAnchorSeconds: null,
                timelineZoomMode: "fit",
                timelineZoomScale: 1.0,
                timelineZoom: 50,
                timelineFitRevision: state.timelineFitRevision + 1,
              }
            : addedFirstClip && firstClip
              ? {
                  timelineFitAnchorSeconds: firstClip.duration,
                  timelineZoomMode: "fit",
                  timelineZoomScale: 1.0,
                  timelineZoom: 50,
                  timelineFitRevision: state.timelineFitRevision + 1,
                }
              : {}),
        });
      }
      return result;
    },
    ...createUiActions(set, get),
    ...createSelectionActions(set, get),
    ...createLaneActions(set, get),
    ...createDocumentActions(set, get),
    ...createProjectLifecycleActions(set),
    ...createClipActions(set, get),
    ...createClipboardActions(set, get),
  }));
}

export const useEditorStore = createEditorStore();
