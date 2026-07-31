/**
 * Per-instance timeline session — document read model + zoom/fit +
 * selection + property command/history bus.
 */

import {
  canRedo,
  canUndo,
  createHistoryState,
  executePropertyCommand,
  redoHistory,
  replaceOrPushHistory,
  resolveFitAnchorSeconds,
  selectionNone,
  sliderValueToZoomScale,
  undoHistory,
  type DocumentPropertyCommand,
  type EditorSelection,
  type HistoryState,
  type TimelineClip,
  type TimelineDocument,
  type TimelineLane,
} from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-schema";
import { loadTimelineFromDocumentJson } from "../document/load-envelope";
import { serializeProjectIntoDocumentJson } from "../document/serialize-envelope";

export type TimelineZoomMode = "manual" | "fit";

export type TimelineSessionState = {
  projectId: string | null;
  projectName: string;
  fps: number;
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  timelineZoom: number;
  timelineZoomScale: number;
  timelineZoomMode: TimelineZoomMode;
  timelineFitAnchorSeconds: number | null;
  timelineFitRevision: number;
  documentRevision: number;
  loadError: string | null;
  selection: EditorSelection;
  history: HistoryState;
  /** Last JSON emitted by a session mutation (property/undo/redo). */
  sessionDocumentJson: string | null;
  /** Base envelope JSON used when serializing command results. */
  baseDocumentJson: string | null;
};

export type TimelineSessionEvent =
  | { type: "REPLACE_DOCUMENT"; documentJson: string }
  | { type: "APPLY_DOCUMENT_JSON"; documentJson: string }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "FIT_TIMELINE" }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_SELECTION"; selection: EditorSelection }
  | {
      type: "EXECUTE_PROPERTY_COMMAND";
      command: DocumentPropertyCommand;
      label: string;
      coalesceKey?: string;
      entryId: string;
    }
  | { type: "UNDO" }
  | { type: "REDO" };

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
    timelineZoom: 50,
    timelineZoomScale: 1,
    timelineZoomMode: "fit",
    timelineFitAnchorSeconds: null,
    timelineFitRevision: 0,
    documentRevision: 0,
    loadError: null,
    selection: selectionNone(),
    history: createHistoryState(),
    sessionDocumentJson: null,
    baseDocumentJson: null,
  };
}

export function reduceTimelineSession(
  state: TimelineSessionState,
  event: TimelineSessionEvent,
): TimelineSessionState {
  switch (event.type) {
    case "REPLACE_DOCUMENT": {
      try {
        const loaded = loadTimelineFromDocumentJson(event.documentJson);
        const anchor = resolveFitAnchorSeconds(loaded.clips);
        return {
          ...state,
          projectId: loaded.projectId,
          projectName: loaded.projectName,
          fps: loaded.fps,
          project: loaded.project,
          clips: loaded.clips,
          lanes: loaded.lanes,
          timelineZoom: 50,
          timelineZoomScale: 1,
          timelineZoomMode: "fit",
          timelineFitAnchorSeconds: anchor,
          timelineFitRevision: state.timelineFitRevision + 1,
          documentRevision: state.documentRevision + 1,
          loadError: null,
          selection: selectionNone(),
          history: createHistoryState(),
          sessionDocumentJson: event.documentJson,
          baseDocumentJson: event.documentJson,
        };
      } catch (error) {
        return {
          ...state,
          loadError:
            error instanceof Error ? error.message : "Failed to load timeline.",
        };
      }
    }
    case "APPLY_DOCUMENT_JSON": {
      // External merge (assets/debug) — keep selection/history.
      try {
        const loaded = loadTimelineFromDocumentJson(event.documentJson);
        return {
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
        };
      } catch (error) {
        return {
          ...state,
          loadError:
            error instanceof Error
              ? error.message
              : "Failed to apply document JSON.",
        };
      }
    }
    case "SET_ZOOM": {
      const zoom = Math.min(100, Math.max(0, event.zoom));
      return {
        ...state,
        timelineZoom: zoom,
        timelineZoomScale: sliderValueToZoomScale(zoom),
        timelineZoomMode: "manual",
      };
    }
    case "FIT_TIMELINE": {
      const anchor = resolveFitAnchorSeconds(state.clips);
      return {
        ...state,
        timelineZoom: 50,
        timelineZoomScale: 1,
        timelineZoomMode: "fit",
        timelineFitAnchorSeconds: anchor,
        timelineFitRevision: state.timelineFitRevision + 1,
      };
    }
    case "CLEAR_ERROR":
      return { ...state, loadError: null };
    case "SET_SELECTION":
      return { ...state, selection: event.selection };
    case "EXECUTE_PROPERTY_COMMAND": {
      const before = toDocument(state);
      const baseJson = state.baseDocumentJson;
      if (!before || !baseJson) {
        return {
          ...state,
          loadError: "No document loaded for property edit.",
        };
      }
      const result = executePropertyCommand(before, event.command);
      if (result.status !== "applied") {
        return {
          ...state,
          loadError: result.message,
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
          beforeSelection: state.selection,
          afterSelection: state.selection,
        },
        { coalesceKey: event.coalesceKey },
      );
      return {
        ...state,
        ...applied,
        history,
        loadError: null,
      };
    }
    case "UNDO": {
      if (!canUndo(state.history) || !state.baseDocumentJson) return state;
      const { state: nextHistory, entry } = undoHistory(state.history);
      if (!entry) return state;
      const applied = applyDocument(state, entry.before, state.baseDocumentJson);
      return {
        ...state,
        ...applied,
        history: nextHistory,
        selection: entry.beforeSelection ?? state.selection,
        loadError: null,
      };
    }
    case "REDO": {
      if (!canRedo(state.history) || !state.baseDocumentJson) return state;
      const { state: nextHistory, entry } = redoHistory(state.history);
      if (!entry) return state;
      const applied = applyDocument(state, entry.after, state.baseDocumentJson);
      return {
        ...state,
        ...applied,
        history: nextHistory,
        selection: entry.afterSelection ?? state.selection,
        loadError: null,
      };
    }
    default:
      return state;
  }
}
