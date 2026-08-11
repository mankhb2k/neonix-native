/**
 * Per-instance timeline document session — clips/lanes/history/json.
 * Zoom/fit/selection/clipboard live in editor-ui-session.
 */

import {
  canRedo,
  canUndo,
  createHistoryState,
  executePropertyCommand,
  executeTimelineCommand,
  pushHistory,
  redoHistory,
  replaceOrPushHistory,
  resolveFitAnchorSeconds,
  selectionNone,
  undoHistory,
  type ClipClipboardItem,
  type DocumentPropertyCommand,
  type EditorSelection,
  type HistoryState,
  type TimelineClip,
  type TimelineCommand,
  type TimelineDocument,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { loadTimelineFromDocumentJson } from "../document/load-envelope";
import { serializeProjectIntoDocumentJson } from "../document/serialize-envelope";
import type { EditorUiPatch } from "./editor-ui-session";
import type { MotionProject } from "@motionvideo/motion-protocol";

export type TimelineSessionState = {
  projectId: string | null;
  projectName: string;
  fps: number;
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  documentRevision: number;
  loadError: string | null;
  history: HistoryState;
  /** Last JSON emitted by a session mutation (property/undo/redo). */
  sessionDocumentJson: string | null;
  /** Base envelope JSON used when serializing command results. */
  baseDocumentJson: string | null;
};

export type TimelineSessionEvent =
  | { type: "REPLACE_DOCUMENT"; documentJson: string }
  | { type: "APPLY_DOCUMENT_JSON"; documentJson: string }
  | { type: "CLEAR_ERROR" }
  | {
      type: "SET_PROJECT_NAME";
      name: string;
      entryId: string;
      selection: EditorSelection;
    }
  | {
      type: "EXECUTE_PROPERTY_COMMAND";
      command: DocumentPropertyCommand;
      label: string;
      coalesceKey?: string;
      entryId: string;
      selection: EditorSelection;
    }
  | {
      type: "EXECUTE_TIMELINE_COMMAND";
      command: TimelineCommand;
      label?: string;
      entryId: string;
      selection: EditorSelection;
      clipboard: ClipClipboardItem[];
    }
  | { type: "UNDO" }
  | { type: "REDO" };

export type TimelineReduceResult = {
  state: TimelineSessionState;
  ui?: EditorUiPatch;
};

function toDocument(state: TimelineSessionState): TimelineDocument | null {
  if (!state.project) return null;
  return {
    project: state.project,
    clips: state.clips,
    lanes: state.lanes,
  };
}

function applyDocument(
  state: TimelineSessionState,
  document: TimelineDocument,
  baseJson: string,
): Pick<
  TimelineSessionState,
  | "project"
  | "clips"
  | "lanes"
  | "projectName"
  | "sessionDocumentJson"
  | "baseDocumentJson"
  | "documentRevision"
> {
  const sessionDocumentJson = serializeProjectIntoDocumentJson(
    baseJson,
    document.project,
    document.clips,
    document.lanes,
  );
  return {
    project: document.project,
    clips: document.clips,
    lanes: document.lanes,
    projectName: document.project.metadata.name?.trim() || "Untitled",
    sessionDocumentJson,
    baseDocumentJson: sessionDocumentJson,
    documentRevision: state.documentRevision + 1,
  };
}

export function createInitialTimelineSession(): TimelineSessionState {
  return {
    projectId: null,
    projectName: "Untitled",
    fps: 30,
    project: null,
    clips: [],
    lanes: [],
    documentRevision: 0,
    loadError: null,
    history: createHistoryState(),
    sessionDocumentJson: null,
    baseDocumentJson: null,
  };
}

export function reduceTimelineSession(
  state: TimelineSessionState,
  event: TimelineSessionEvent,
): TimelineReduceResult {
  switch (event.type) {
    case "REPLACE_DOCUMENT": {
      try {
        const loaded = loadTimelineFromDocumentJson(event.documentJson);
        const anchor = resolveFitAnchorSeconds(loaded.clips);
        return {
          state: {
            ...state,
            projectId: loaded.projectId,
            projectName: loaded.projectName,
            fps: loaded.fps,
            project: loaded.project,
            clips: loaded.clips,
            lanes: loaded.lanes,
            documentRevision: state.documentRevision + 1,
            loadError: null,
            history: createHistoryState(),
            sessionDocumentJson: event.documentJson,
            baseDocumentJson: event.documentJson,
          },
          ui: {
            timelineZoom: 50,
            timelineZoomScale: 1,
            timelineZoomMode: "fit",
            timelineFitAnchorSeconds: anchor,
            timelineFitRevisionBump: true,
            selection: selectionNone(),
            clipboard: [],
          },
        };
      } catch (error) {
        return {
          state: {
            ...state,
            loadError:
              error instanceof Error
                ? error.message
                : "Failed to load timeline.",
          },
        };
      }
    }
    case "APPLY_DOCUMENT_JSON": {
      try {
        const loaded = loadTimelineFromDocumentJson(event.documentJson);
        return {
          state: {
            ...state,
            projectId: loaded.projectId,
            projectName: loaded.projectName,
            fps: loaded.fps,
            project: loaded.project,
            clips: loaded.clips,
            lanes: loaded.lanes,
            documentRevision: state.documentRevision + 1,
            loadError: null,
            sessionDocumentJson: event.documentJson,
            baseDocumentJson: event.documentJson,
          },
        };
      } catch (error) {
        return {
          state: {
            ...state,
            loadError:
              error instanceof Error
                ? error.message
                : "Failed to apply document JSON.",
          },
        };
      }
    }
    case "CLEAR_ERROR":
      return { state: { ...state, loadError: null } };
    case "SET_PROJECT_NAME": {
      const before = toDocument(state);
      const baseJson = state.baseDocumentJson;
      if (!before || !baseJson || !state.project) {
        return {
          state: {
            ...state,
            loadError: "No document loaded for rename.",
          },
        };
      }
      const trimmed = event.name.trim() || "Untitled";
      const nextProject = {
        ...state.project,
        metadata: {
          ...state.project.metadata,
          name: trimmed,
        },
      };
      const after: TimelineDocument = {
        ...before,
        project: nextProject,
      };
      const applied = applyDocument(state, after, baseJson);
      const history = pushHistory(state.history, {
        id: event.entryId,
        timestamp: Date.now(),
        label: "Rename project",
        before,
        after,
        beforeSelection: event.selection,
        afterSelection: event.selection,
      });
      return {
        state: {
          ...state,
          ...applied,
          projectName: trimmed,
          history,
          loadError: null,
        },
      };
    }
    case "EXECUTE_PROPERTY_COMMAND": {
      const before = toDocument(state);
      const baseJson = state.baseDocumentJson;
      if (!before || !baseJson) {
        return {
          state: {
            ...state,
            loadError: "No document loaded for property edit.",
          },
        };
      }
      const result = executePropertyCommand(before, event.command);
      if (result.status !== "applied") {
        return {
          state: {
            ...state,
            loadError: result.message,
          },
        };
      }
      const applied = applyDocument(state, result.document, baseJson);
      const history = replaceOrPushHistory(
        state.history,
        {
          id: event.entryId,
          timestamp: Date.now(),
          label: event.label,
          coalesceKey: event.coalesceKey,
          before,
          after: result.document,
          beforeSelection: event.selection,
          afterSelection: event.selection,
        },
        { coalesceKey: event.coalesceKey },
      );
      return {
        state: {
          ...state,
          ...applied,
          history,
          loadError: null,
        },
      };
    }
    case "EXECUTE_TIMELINE_COMMAND": {
      const before = toDocument(state);
      const baseJson = state.baseDocumentJson;
      if (!before || !baseJson) {
        return {
          state: {
            ...state,
            loadError: "No document loaded for timeline edit.",
          },
        };
      }
      const wasEmpty = before.clips.length === 0;
      const result = executeTimelineCommand(
        before,
        event.command,
        event.selection,
        event.clipboard,
      );
      if (result.status !== "applied") {
        return {
          state: {
            ...state,
            loadError: result.message,
          },
        };
      }
      const afterSelection = result.selection ?? event.selection;
      const applied = applyDocument(state, result.document, baseJson);
      const history = pushHistory(state.history, {
        id: event.entryId,
        timestamp: Date.now(),
        label: event.label ?? event.command.type,
        before,
        after: result.document,
        beforeSelection: event.selection,
        afterSelection,
      });

      const isEmptyNow = result.document.clips.length === 0;
      const addedFirstClip = wasEmpty && !isEmptyNow;
      const firstClip = result.document.clips[0];
      const ui: EditorUiPatch = {
        selection: afterSelection,
        clipboard: result.clipboard ?? event.clipboard,
      };
      if (isEmptyNow) {
        ui.timelineFitAnchorSeconds = null;
        ui.timelineZoomMode = "fit";
        ui.timelineZoomScale = 1;
        ui.timelineZoom = 50;
        ui.timelineFitRevisionBump = true;
      } else if (addedFirstClip && firstClip) {
        ui.timelineFitAnchorSeconds = firstClip.duration;
        ui.timelineZoomMode = "fit";
        ui.timelineZoomScale = 1;
        ui.timelineZoom = 50;
        ui.timelineFitRevisionBump = true;
      }

      return {
        state: {
          ...state,
          ...applied,
          history,
          loadError: null,
        },
        ui,
      };
    }
    case "UNDO": {
      if (!canUndo(state.history) || !state.baseDocumentJson) {
        return { state };
      }
      const { state: nextHistory, entry } = undoHistory(state.history);
      if (!entry) return { state };
      const applied = applyDocument(
        state,
        entry.before,
        state.baseDocumentJson,
      );
      return {
        state: {
          ...state,
          ...applied,
          history: nextHistory,
          loadError: null,
        },
        ui: entry.beforeSelection
          ? { selection: entry.beforeSelection }
          : undefined,
      };
    }
    case "REDO": {
      if (!canRedo(state.history) || !state.baseDocumentJson) {
        return { state };
      }
      const { state: nextHistory, entry } = redoHistory(state.history);
      if (!entry) return { state };
      const applied = applyDocument(state, entry.after, state.baseDocumentJson);
      return {
        state: {
          ...state,
          ...applied,
          history: nextHistory,
          loadError: null,
        },
        ui: entry.afterSelection
          ? { selection: entry.afterSelection }
          : undefined,
      };
    }
    default:
      return { state };
  }
}
