import type { TimelineCommand } from "@motionvideo/editor-core";

/**
 * Single facade for editor chrome actions — toolbar, menus, and shortcuts
 * must call through here instead of dispatching ad hoc.
 */
export type EditorActions = {
  goHome: () => void;
  save: () => void;
  saveAs: () => void;
  undo: () => void;
  redo: () => void;
  fitTimeline: () => void;
  setZoom: (zoom: number) => void;
  executeTimeline: (command: TimelineCommand, label: string) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  saving: boolean;
  dirty: boolean;
  path: string | null;
  projectName: string;
  nameDraft: string;
  setNameDraft: (value: string) => void;
  commitProjectName: () => void;
  rollbackProjectName: () => void;
  skipNameCommit: () => void;
  /** Flush name draft and return document JSON to persist. */
  flushDocumentSnapshot: () => string;
};

export function flushNameThen(actions: EditorActions, next: () => void): void {
  void actions.flushDocumentSnapshot();
  next();
}
