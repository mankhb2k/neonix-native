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
import { mapNode } from "@/lib/editor/store/internal/scene-utils";
import type { EditorStore } from "@/lib/editor/store/types";
import { executeTimelineCommand } from "@/lib/editor/timeline/commands/command-runner";
import { documentFromStoreState } from "@/lib/editor/timeline/document";
import {
  canRedo,
  canUndo,
  clearHistory,
  createHistoryState,
  pushHistory,
  redoHistory,
  replaceOrPushHistory,
  undoHistory,
} from "@/lib/editor/timeline/history/history-manager";
import type { HistoryEntry } from "@/lib/editor/timeline/history/history-types";
import { createDemoMotionProject } from "@motionvideo/remotion-renderer";
import {
  isPropertyLocked,
  markUserModified,
  toggleElementLock,
  togglePropertyLock,
} from "@/lib/editor/authoring/web-project-envelope";
import { executePropertyCommand } from "@motionvideo/editor-core";

export function createEditorStore(initialState?: Partial<EditorStore>) {
  let historyState = createHistoryState();

  return create<EditorStore>((set, get) => ({
    ...createInitialEditorState(),
    ...initialState,
    undo: () => {
      const res = undoHistory(historyState);
      if (res.entry) {
        historyState = res.state;
        const entry = res.entry;
        set({
          project: entry.before.project,
          timelineLanes: entry.before.lanes,
          timelineClips: entry.before.clips,
          dirtyRevision: get().dirtyRevision + 1,
          ...(entry.beforeSelection ? { selection: entry.beforeSelection } : {}),
          canUndo: canUndo(historyState),
          canRedo: canRedo(historyState),
        });
      }
    },
    redo: () => {
      const res = redoHistory(historyState);
      if (res.entry) {
        historyState = res.state;
        const entry = res.entry;
        set({
          project: entry.after.project,
          timelineLanes: entry.after.lanes,
          timelineClips: entry.after.clips,
          dirtyRevision: get().dirtyRevision + 1,
          ...(entry.afterSelection ? { selection: entry.afterSelection } : {}),
          canUndo: canUndo(historyState),
          canRedo: canRedo(historyState),
        });
      }
    },
    clearHistory: () => {
      historyState = clearHistory();
      set({ canUndo: false, canRedo: false });
    },
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
      const beforeDoc = doc;
      const beforeSelection = state.selection;
      const wasEmpty = state.timelineClips.length === 0;

      const result = executeTimelineCommand(
        doc,
        command,
        state.selection,
        state.timelineClipboard ?? [],
      );

      if (result.status === "applied") {
        const afterDoc = result.document;
        const afterSelection = result.selection ?? state.selection;
        const entry: HistoryEntry = {
          id: `hist_${Math.random().toString(36).slice(2, 9)}`,
          timestamp: Date.now(),
          label: command.type,
          before: beforeDoc,
          after: afterDoc,
          beforeSelection,
          afterSelection,
        };
        historyState = pushHistory(historyState, entry);

        const isEmptyNow = result.document.clips.length === 0;
        const addedFirstClip = wasEmpty && !isEmptyNow;
        const firstClip = result.document.clips[0];

        set({
          project: result.document.project,
          timelineLanes: result.document.lanes,
          timelineClips: result.document.clips,
          dirtyRevision: state.dirtyRevision + 1,
          canUndo: canUndo(historyState),
          canRedo: canRedo(historyState),
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
    markDocumentSaved: () => {
      const { dirtyRevision } = get();
      set({ savedRevision: dirtyRevision });
    },
    commitNodeTransform: (sceneId, nodeId, patch) => {
      const state = get();
      if (!state.project) return;
      const lockedPaths = Object.keys(patch).map((k) => `transform.${k}`);
      if (
        lockedPaths.some((path) =>
          isPropertyLocked(state.envelope, sceneId, nodeId, path),
        )
      ) {
        return;
      }
      const beforeDoc = documentFromStoreState(state);
      if (!beforeDoc) return;

      const nextProject = mapNode(state.project, sceneId, nodeId, (node) => ({
        ...node,
        transform: {
          ...node.transform,
          x: patch.x ?? node.transform.x,
          y: patch.y ?? node.transform.y,
          width: patch.width ?? node.transform.width,
          height: patch.height ?? node.transform.height,
          rotation: patch.rotation ?? node.transform.rotation,
        },
      }));

      const envelope = state.envelope
        ? markUserModified(state.envelope, sceneId, nodeId, lockedPaths)
        : state.envelope;

      set({
        project: nextProject,
        envelope,
        dirtyRevision: state.dirtyRevision + 1,
      });

      const afterDoc = documentFromStoreState(get());
      if (!afterDoc) return;

      const entry: HistoryEntry = {
        id: `hist_${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
        label: "set-node-transform",
        before: beforeDoc,
        after: afterDoc,
        beforeSelection: state.selection,
        afterSelection: state.selection,
      };
      historyState = pushHistory(historyState, entry);
      set({
        canUndo: canUndo(historyState),
        canRedo: canRedo(historyState),
      });
    },
    setElementLocked: (sceneId, nodeId, locked) => {
      const state = get();
      if (!state.envelope) return;
      set({
        envelope: toggleElementLock(state.envelope, sceneId, nodeId, locked),
        dirtyRevision: state.dirtyRevision + 1,
      });
    },
    setPropertyLocked: (sceneId, nodeId, propertyPath, locked) => {
      const state = get();
      if (!state.envelope) return;
      set({
        envelope: togglePropertyLock(
          state.envelope,
          sceneId,
          nodeId,
          propertyPath,
          locked,
        ),
        dirtyRevision: state.dirtyRevision + 1,
      });
    },
    dispatchPropertyCommand: (command, options) => {
      const state = get();
      let project = state.project;
      if (!project) return;

      if (project.scenes.length === 0) {
        project = createDemoMotionProject();
        set({
          project,
          envelope: state.envelope ?? {
            id: project.metadata.id,
            revision: 1,
            authoring: { elementMeta: {} },
          },
        });
      }

      if (
        command.type === "set-node-transform" ||
        command.type === "set-node-style" ||
        command.type === "set-node-text" ||
        command.type === "set-node-metadata"
      ) {
        for (const target of command.targets) {
          const paths =
            command.type === "set-node-transform"
              ? Object.keys(command.patch).map((k) => `transform.${k}`)
              : command.type === "set-node-style"
                ? Object.keys(command.patch).map((k) => `style.${k}`)
                : command.type === "set-node-text"
                  ? Object.keys(command.patch).map((k) => `text.${k}`)
                  : ["metadata"];
          if (
            paths.some((path) =>
              isPropertyLocked(
                get().envelope,
                target.sceneId,
                target.nodeId,
                path,
              ),
            )
          ) {
            return;
          }
        }
      }

      const doc = documentFromStoreState(get());
      if (!doc?.project) return;
      const beforeDoc = doc;
      const result = executePropertyCommand(doc, command);
      if (result.status !== "applied") return;

      let envelope = get().envelope;
      if (
        envelope &&
        (command.type === "set-node-transform" ||
          command.type === "set-node-style" ||
          command.type === "set-node-text")
      ) {
        for (const target of command.targets) {
          const paths =
            command.type === "set-node-transform"
              ? Object.keys(command.patch).map((k) => `transform.${k}`)
              : command.type === "set-node-style"
                ? Object.keys(command.patch).map((k) => `style.${k}`)
                : Object.keys(command.patch).map((k) => `text.${k}`);
          envelope = markUserModified(
            envelope,
            target.sceneId,
            target.nodeId,
            paths,
          );
        }
      }

      const afterDoc = result.document;
      const entry: HistoryEntry = {
        id: `hist_${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
        label: command.type,
        before: beforeDoc,
        after: afterDoc,
        beforeSelection: state.selection,
        afterSelection: state.selection,
        coalesceKey: options?.coalesceKey,
      };
      historyState = replaceOrPushHistory(historyState, entry, {
        coalesceKey: options?.coalesceKey,
      });
      set({
        project: afterDoc.project,
        envelope,
        dirtyRevision: state.dirtyRevision + 1,
        canUndo: canUndo(historyState),
        canRedo: canRedo(historyState),
      });
    },
    ...createUiActions(set, get),
    ...createSelectionActions(set, get),
    ...createLaneActions(set, get),
    ...createDocumentActions(set, get),
    ...createProjectLifecycleActions(set, get),
    ...createClipActions(set, get),
    ...createClipboardActions(set, get),
  }));
}

export const useEditorStore = createEditorStore();
