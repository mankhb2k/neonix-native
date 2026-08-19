"use client";

import { create } from "zustand";

import { applyAiProjectToStore } from "@/lib/editor/ai/apply-ai-project";
import {
  createEmptyEnvelope,
  isPropertyLocked,
  markUserModified,
  setLayerDisplayName,
  toggleElementLock,
  togglePropertyLock,
} from "@/lib/editor/authoring/web-project-envelope";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { createClipActions } from "@/lib/editor/store/actions/clip-actions";
import { createClipboardActions } from "@/lib/editor/store/actions/clipboard-actions";
import { createDocumentActions } from "@/lib/editor/store/actions/document-actions";
import { createGroupActions } from "@/lib/editor/store/actions/group-actions";
import { createLaneActions } from "@/lib/editor/store/actions/lane-actions";
import { createProjectLifecycleActions } from "@/lib/editor/store/actions/project-lifecycle-actions";
import { createSelectionActions } from "@/lib/editor/store/actions/selection-actions";
import { createUiActions } from "@/lib/editor/store/actions/ui-actions";
import { commitProjectMutation } from "@/lib/editor/store/commit-document-mutation";
import { createInitialEditorState } from "@/lib/editor/store/initial-state";
import {
  canRedo,
  canUndo,
  clearHistory,
  createHistoryState,
  documentFromStoreState,
  executePropertyCommand,
  executeTimelineCommand,
  mapNode,
  packRootLayersToTimeline,
  projectToTimelineDocument,
  pushHistory,
  redoHistory,
  replaceOrPushHistory,
  syncProjectProtocolContract,
  undoHistory,
  type DocumentPropertyCommand,
  type HistoryEntry,
} from "@motionvideo/editor-core";
import { deriveProjectDurationV1 } from "@motionvideo/patterns";
import { createFacebookHistoryDemoProject } from "@motionvideo/motion-runtime/testing";
import type { EditorStore } from "@/lib/editor/store/types";

function authoringPathsForCommand(
  command: DocumentPropertyCommand,
): string[] | null {
  switch (command.type) {
    case "set-node-transform":
      return Object.keys(command.patch).map((key) => `transform.${key}`);
    case "set-node-style":
      return Object.keys(command.patch).map((key) => `style.${key}`);
    case "set-node-text":
      return Object.keys(command.patch).map((key) => `text.${key}`);
    case "set-node-metadata":
      return ["metadata"];
    default:
      return null;
  }
}

export function createEditorStore(initialState?: Partial<EditorStore>) {
  let historyState = createHistoryState();

  return create<EditorStore>((set, get) => {
    const pushEntry = (entry: HistoryEntry) => {
      historyState = pushHistory(historyState, entry);
      set({
        canUndo: canUndo(historyState),
        canRedo: canRedo(historyState),
      });
    };

    return {
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
            ...(entry.beforeSelection
              ? { selection: entry.beforeSelection }
              : {}),
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
            ...(entry.afterSelection
              ? { selection: entry.afterSelection }
              : {}),
            canUndo: canUndo(historyState),
            canRedo: canRedo(historyState),
          });
        }
      },
      clearHistory: () => {
        historyState = clearHistory();
        set({ canUndo: false, canRedo: false });
      },
      applyAiProject: (project, meta) => {
        applyAiProjectToStore(
          set,
          get,
          (entry) => {
            historyState = pushHistory(historyState, entry);
          },
          project,
          meta,
        );
        set({
          canUndo: canUndo(historyState),
          canRedo: canRedo(historyState),
        });
      },
      executeTimelineCommand: (command) => {
        const state = get();
        const storeDoc = documentFromStoreState(state);
        if (!storeDoc) {
          return {
            status: "rejected",
            reason: "no_project",
            message: "Project chưa được nạp vào store.",
          };
        }
        const inGroup = state.groupPath.length > 0;
        const doc = inGroup
          ? projectToTimelineDocument(
              storeDoc.project,
              storeDoc.revision,
              state.groupPath,
            )
          : storeDoc;
        const beforeDoc = storeDoc;
        const beforeSelection = state.selection;
        const wasEmpty = state.timelineClips.length === 0;

        const result = executeTimelineCommand(
          doc,
          command,
          state.selection,
          state.timelineClipboard ?? [],
        );

        if (result.status === "applied") {
          const packedMain = inGroup
            ? packRootLayersToTimeline(result.document.project)
            : {
                lanes: result.document.lanes,
                clips: result.document.clips,
              };
          const afterDoc = {
            ...result.document,
            lanes: packedMain.lanes,
            clips: packedMain.clips,
          };
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

          const isEmptyNow = packedMain.clips.length === 0;
          const addedFirstClip = wasEmpty && !isEmptyNow;
          const firstClip = packedMain.clips[0];

          set({
            project: result.document.project,
            timelineLanes: packedMain.lanes,
            timelineClips: packedMain.clips,
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
      commitNodeTransform: (rootLayerId, layerId, patch) => {
        const state = get();
        if (!state.project) return;
        const lockedPaths = Object.keys(patch).map((key) => `transform.${key}`);
        if (
          lockedPaths.some((path) =>
            isPropertyLocked(state.envelope, rootLayerId, layerId, path),
          )
        ) {
          return;
        }

        const nextProject = mapNode(
          state.project,
          rootLayerId,
          layerId,
          (node) => {
            if (!("transform" in node) || !node.transform) return node;
            return {
              ...node,
              ...("frame" in node
                ? {
                    frame: {
                      width: patch.width ?? node.frame.width,
                      height: patch.height ?? node.frame.height,
                    },
                  }
                : {}),
              transform: {
                ...node.transform,
                translate: {
                  ...node.transform.translate,
                  x: patch.x ?? node.transform.translate.x,
                  y: patch.y ?? node.transform.translate.y,
                },
                rotate: {
                  ...node.transform.rotate,
                  z: patch.rotation ?? node.transform.rotate.z,
                },
              },
            };
          },
        );

        commitProjectMutation(set, get, pushEntry, {
          nextProject,
          label: "set-node-transform",
          envelope: state.envelope
            ? markUserModified(
                state.envelope,
                rootLayerId,
                layerId,
                lockedPaths,
              )
            : state.envelope,
        });
      },
      setElementLocked: (rootLayerId, layerId, locked) => {
        const state = get();
        if (!state.envelope) return;
        set({
          envelope: toggleElementLock(
            state.envelope,
            rootLayerId,
            layerId,
            locked,
          ),
          dirtyRevision: state.dirtyRevision + 1,
        });
      },
      setPropertyLocked: (rootLayerId, layerId, propertyPath, locked) => {
        const state = get();
        if (!state.envelope) return;
        set({
          envelope: togglePropertyLock(
            state.envelope,
            rootLayerId,
            layerId,
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

        if (project.layers.length === 0) {
          project = syncProjectProtocolContract(
            createFacebookHistoryDemoProject(),
          );
          const { lanes, clips } = packRootLayersToTimeline(project);
          set({
            project,
            timelineLanes: lanes,
            timelineClips: clips,
            envelope: state.envelope ?? {
              id: project.metadata.id,
              revision: 1,
              authoring: { elementMeta: {} },
            },
          });
          usePlaybackClock.getState().reset({
            duration: deriveProjectDurationV1(project.layers),
            currentTime: 0,
          });
        }

        const authoringPaths = authoringPathsForCommand(command);
        if (authoringPaths) {
          const targets = "targets" in command ? command.targets : [];
          for (const target of targets) {
            if (
              authoringPaths.some((path) =>
                isPropertyLocked(
                  get().envelope,
                  target.rootLayerId,
                  target.layerId,
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

        let commandForCore = command;
        if (
          command.type === "set-node-metadata" &&
          command.patch.name !== undefined
        ) {
          let envelope =
            get().envelope ?? createEmptyEnvelope(doc.project.metadata.id);
          for (const target of command.targets) {
            envelope = setLayerDisplayName(
              envelope,
              target.rootLayerId,
              target.layerId,
              command.patch.name,
            );
            envelope = markUserModified(
              envelope,
              target.rootLayerId,
              target.layerId,
              ["metadata"],
            );
          }
          if (command.patch.visible === undefined) {
            const entry: HistoryEntry = {
              id: `hist_${Math.random().toString(36).slice(2, 9)}`,
              timestamp: Date.now(),
              label: command.type,
              before: beforeDoc,
              after: beforeDoc,
              beforeSelection: state.selection,
              afterSelection: state.selection,
              coalesceKey: options?.coalesceKey,
            };
            historyState = replaceOrPushHistory(historyState, entry, {
              coalesceKey: options?.coalesceKey,
            });
            set({
              envelope,
              dirtyRevision: state.dirtyRevision + 1,
              canUndo: canUndo(historyState),
              canRedo: canRedo(historyState),
            });
            return;
          }
          commandForCore = {
            ...command,
            patch: { visible: command.patch.visible },
          };
          set({ envelope });
        }

        const result = executePropertyCommand(doc, commandForCore);
        if (result.status !== "applied") return;

        let envelope = get().envelope;
        if (envelope && authoringPaths && "targets" in command) {
          for (const target of command.targets) {
            envelope = markUserModified(
              envelope,
              target.rootLayerId,
              target.layerId,
              authoringPaths,
            );
          }
        }

        const afterDoc = {
          ...result.document,
          project: syncProjectProtocolContract(result.document.project),
        };
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
      ...createGroupActions(set, get, pushEntry),
      ...createLaneActions(set, get),
      ...createDocumentActions(set, get, pushEntry),
      ...createProjectLifecycleActions(set, get),
      ...createClipActions(set, get),
      ...createClipboardActions(set, get),
    };
  });
}

export const useEditorStore = createEditorStore();
