/**
 * Pure desktop app state machine (Phase 4 shell — no timeline).
 */

import type { RecentProject } from "../../../../src/shared/ipc/contracts";
import {
  parseDesktopProjectFile,
  projectNameFromEnvelope,
} from "../../../../src/shared/project-file/envelope";

export type AppPhase =
  | "booting"
  | "home"
  | "opening"
  | "editing"
  | "saving"
  | "error";

export type AppState = {
  phase: AppPhase;
  path: string | null;
  documentJson: string | null;
  projectId: string | null;
  projectName: string;
  dirty: boolean;
  error: string | null;
  recent: RecentProject[];
  showDiagnostics: boolean;
};

export type AppEvent =
  | { type: "BOOT_DONE"; recent: RecentProject[] }
  | { type: "BOOT_ERROR"; message: string }
  | {
      type: "NEW_PROJECT";
      projectId: string;
      documentJson: string;
      name: string;
    }
  | { type: "OPEN_START" }
  | {
      type: "OPEN_SUCCESS";
      path: string;
      projectId: string;
      documentJson: string;
    }
  | { type: "OPEN_CANCEL" }
  | { type: "OPEN_ERROR"; message: string }
  | { type: "SET_DOCUMENT_JSON"; documentJson: string }
  | { type: "SET_NAME"; name: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; path: string; documentJson: string }
  | { type: "SAVE_ERROR"; message: string }
  | { type: "SAVE_CANCEL" }
  | { type: "GO_HOME"; recent?: RecentProject[] }
  | { type: "SET_RECENT"; recent: RecentProject[] }
  | { type: "SHOW_DIAGNOSTICS"; show: boolean }
  | { type: "CLEAR_ERROR" };

export function createInitialAppState(): AppState {
  return {
    phase: "booting",
    path: null,
    documentJson: null,
    projectId: null,
    projectName: "Untitled",
    dirty: false,
    error: null,
    recent: [],
    showDiagnostics: false,
  };
}

function nameFromDocument(documentJson: string, fallback: string): string {
  try {
    return projectNameFromEnvelope(parseDesktopProjectFile(documentJson));
  } catch {
    return fallback;
  }
}

export function reduceAppState(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "BOOT_DONE":
      return {
        ...state,
        phase: "home",
        recent: event.recent,
        error: null,
      };
    case "BOOT_ERROR":
      return { ...state, phase: "error", error: event.message };
    case "NEW_PROJECT":
      return {
        ...state,
        phase: "editing",
        path: null,
        projectId: event.projectId,
        documentJson: event.documentJson,
        projectName: event.name,
        dirty: true,
        error: null,
        showDiagnostics: false,
      };
    case "OPEN_START":
      return { ...state, phase: "opening", error: null };
    case "OPEN_SUCCESS":
      return {
        ...state,
        phase: "editing",
        path: event.path,
        projectId: event.projectId,
        documentJson: event.documentJson,
        projectName: nameFromDocument(event.documentJson, "Untitled"),
        dirty: false,
        error: null,
        showDiagnostics: false,
      };
    case "OPEN_CANCEL":
      return {
        ...state,
        phase: state.documentJson ? "editing" : "home",
        error: null,
      };
    case "OPEN_ERROR":
      return {
        ...state,
        phase: state.documentJson ? "editing" : "home",
        error: event.message,
      };
    case "SET_DOCUMENT_JSON":
      return {
        ...state,
        documentJson: event.documentJson,
        projectName: nameFromDocument(event.documentJson, state.projectName),
        dirty: true,
      };
    case "SET_NAME": {
      if (!state.documentJson) return state;
      try {
        const envelope = parseDesktopProjectFile(state.documentJson);
        envelope.project.metadata.name = event.name;
        envelope.project.metadata.brand.name = event.name;
        const documentJson = `${JSON.stringify(envelope, null, 2)}\n`;
        return {
          ...state,
          documentJson,
          projectName: event.name,
          dirty: true,
        };
      } catch {
        return { ...state, projectName: event.name, dirty: true };
      }
    }
    case "SAVE_START":
      return { ...state, phase: "saving", error: null };
    case "SAVE_SUCCESS":
      return {
        ...state,
        phase: "editing",
        path: event.path,
        documentJson: event.documentJson,
        projectName: nameFromDocument(event.documentJson, state.projectName),
        dirty: false,
        error: null,
      };
    case "SAVE_ERROR":
      return { ...state, phase: "editing", error: event.message };
    case "SAVE_CANCEL":
      return { ...state, phase: "editing", error: null };
    case "GO_HOME":
      return {
        ...createInitialAppState(),
        phase: "home",
        recent: event.recent ?? state.recent,
      };
    case "SET_RECENT":
      return { ...state, recent: event.recent };
    case "SHOW_DIAGNOSTICS":
      return { ...state, showDiagnostics: event.show };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

/** Close handshake decision — pure. */
export type CloseDecision =
  | { action: "confirm" }
  | { action: "discard" }
  | { action: "save" }
  | { action: "abort" };

export function decideClose(
  dirty: boolean,
  choice: "save" | "discard" | "cancel" | "clean",
): CloseDecision {
  if (!dirty || choice === "clean") return { action: "confirm" };
  if (choice === "cancel") return { action: "abort" };
  if (choice === "discard") return { action: "discard" };
  return { action: "save" };
}
