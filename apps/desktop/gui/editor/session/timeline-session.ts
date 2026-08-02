/**
 * Per-instance timeline session — document read model + zoom/fit +
 * selection + property/timeline command history bus.
 */

import {
  canRedo,
  canUndo,
  clipsContentEndSeconds,
  createHistoryState,
  executePropertyCommand,
  executeTimelineCommand,
  pushHistory,
  redoHistory,
  replaceOrPushHistory,
  resolveFitAnchorSeconds,
  selectionHasLockedLane,
  selectionNone,
  selectedClipIdsFrom,
  sliderValueToZoomScale,
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
import { buildClipboardFromSelection } from "./build-clipboard";
import type { MotionProject } from "@motionvideo/motion-schema";

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
  clipboard: ClipClipboardItem[];
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
  | { type: "SET_PROJECT_NAME"; name: string; entryId: string }
  | { type: "COPY_SELECTION" }
  | { type: "CUT_SELECTION"; entryId: string }
  | { type: "SET_CLIPBOARD"; clipboard: ClipClipboardItem[] }
  | {
      type: "EXECUTE_PROPERTY_COMMAND";
      command: DocumentPropertyCommand;
      label: string;
      coalesceKey?: string;
      entryId: string;
    }
  | {
      type: "EXECUTE_TIMELINE_COMMAND";
      command: TimelineCommand;
      label?: string;
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
    timelineZoom: 50,
    timelineZoomScale: 1,
    timelineZoomMode: "fit",
    timelineFitAnchorSeconds: null,
    timelineFitRevision: 0,
    documentRevision: 0,
    loadError: null,
    selection: selectionNone(),
    clipboard: [],
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
          clipboard: [],
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
      // CapCut fit: 1 clip → clip fills 1/3 viewport; 2+ → whole content
      // with ~1/3 empty after the end (fitSpan = contentEnd × 1.5).
      const contentEnd = clipsContentEndSeconds(state.clips);
      const anchor =
        state.clips.length <= 1
          ? resolveFitAnchorSeconds(state.clips)
          : contentEnd > 0
            ? contentEnd / 2
            : null;
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
    case "COPY_SELECTION": {
      const clipboard = buildClipboardFromSelection({
        selection: state.selection,
        clips: state.clips,
        lanes: state.lanes,
        project: state.project,
      });
      return { ...state, clipboard, loadError: null };
    }
    case "SET_CLIPBOARD":
      return { ...state, clipboard: event.clipboard, loadError: null };
    case "CUT_SELECTION": {
      const ids = selectedClipIdsFrom(state.selection);
      if (
        ids.length === 0 ||
        selectionHasLockedLane(state.clips, state.lanes, ids)
      ) {
        return state;
      }
      const clipboard = buildClipboardFromSelection({
        selection: state.selection,
        clips: state.clips,
        lanes: state.lanes,
        project: state.project,
      });
      if (clipboard.length === 0) return state;
      const withClipboard = { ...state, clipboard };
      return reduceTimelineSession(withClipboard, {
        type: "EXECUTE_TIMELINE_COMMAND",
        command: { type: "delete-selected-clips" },
        label: "Cut clips",
        entryId: event.entryId,
      });
    }
    case "SET_PROJECT_NAME": {
      const before = toDocument(state);
      const baseJson = state.baseDocumentJson;
      if (!before || !baseJson || !state.project) {
        return {
          ...state,
          loadError: "No document loaded for rename.",
        };
      }
      const trimmed = event.name.trim() || "Untitled";
      const nextProject = {
        ...state.project,
        metadata: {
          ...state.project.metadata,
          name: trimmed,
          brand: {
            ...state.project.metadata.brand,
            name: trimmed,
          },
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
        beforeSelection: state.selection,
        afterSelection: state.selection,
      });
      return {
        ...state,
        ...applied,
        projectName: trimmed,
        history,
        loadError: null,
      };
    }
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
    case "EXECUTE_TIMELINE_COMMAND": {
      const before = toDocument(state);
      const baseJson = state.baseDocumentJson;
      if (!before || !baseJson) {
        return {
          ...state,
          loadError: "No document loaded for timeline edit.",
        };
      }
      const wasEmpty = before.clips.length === 0;
      const result = executeTimelineCommand(
        before,
        event.command,
        state.selection,
        state.clipboard,
      );
      if (result.status !== "applied") {
        return {
          ...state,
          loadError: result.message,
        };
      }
      const afterSelection = result.selection ?? state.selection;
      const applied = applyDocument(state, result.document, baseJson);
      const history = pushHistory(state.history, {
        id: event.entryId,
        timestamp: Date.now(),
        label: event.label ?? event.command.type,
        before,
        after: result.document,
        beforeSelection: state.selection,
        afterSelection,
      });

      // CapCut: first clip → fit so clip occupies 1/3 of the viewport;
      // last clip deleted → reset fit baseline.
      const isEmptyNow = result.document.clips.length === 0;
      const addedFirstClip = wasEmpty && !isEmptyNow;
      const firstClip = result.document.clips[0];
      const fitPatch =
        isEmptyNow
          ? {
              timelineFitAnchorSeconds: null as number | null,
              timelineZoomMode: "fit" as const,
              timelineZoomScale: 1,
              timelineZoom: 50,
              timelineFitRevision: state.timelineFitRevision + 1,
            }
          : addedFirstClip && firstClip
            ? {
                timelineFitAnchorSeconds: firstClip.duration,
                timelineZoomMode: "fit" as const,
                timelineZoomScale: 1,
                timelineZoom: 50,
                timelineFitRevision: state.timelineFitRevision + 1,
              }
            : {};

      return {
        ...state,
        ...applied,
        ...fitPatch,
        selection: afterSelection,
        clipboard: result.clipboard ?? state.clipboard,
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
