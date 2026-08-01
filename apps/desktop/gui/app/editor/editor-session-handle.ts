/**
 * Handle registered by EditingWorkspace so DesktopApp (native close / home / save)
 * owns a single persistence flush — chrome must not pre-flush.
 */

export type EditorSessionSnapshot = {
  documentJson: string;
  projectName: string;
  dirty: boolean;
};

export type EditorSessionHandle = {
  /** Single flush of rename draft + dirty/projectName for persistence. */
  flushSnapshot(): EditorSessionSnapshot;
};

/** Resolve project name after a flush (trim draft or keep current). */
export function resolveFlushedProjectName(input: {
  skipNameCommit: boolean;
  nameDraftDirty: boolean;
  nameDraft: string;
  projectName: string;
}): string {
  if (input.skipNameCommit) return input.projectName;
  if (!input.nameDraftDirty) return input.projectName;
  return input.nameDraft.trim() || "Untitled";
}
