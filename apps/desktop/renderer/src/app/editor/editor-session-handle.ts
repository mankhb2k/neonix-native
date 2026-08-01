/**
 * Handle registered by EditingWorkspace so DesktopApp (native close / home)
 * can flush rename drafts before dirty checks and save.
 */

export type EditorSessionSnapshot = {
  documentJson: string;
  dirty: boolean;
};

export type EditorSessionHandle = {
  flushSnapshot(): EditorSessionSnapshot;
};
