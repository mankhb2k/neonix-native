/**
 * Pure helper: after an in-flight name draft, return the JSON that Save/Export/Close
 * must persist — never a stale pre-rename snapshot.
 */

export type FlushDocumentSnapshotInput = {
  skipNameCommit: boolean;
  nameDraftDirty: boolean;
  nameDraft: string;
  projectName: string;
  /** JSON after applying rename in session (when dirty). */
  renamedDocumentJson: string | null;
  /** Current session / file JSON when no rename applies. */
  currentDocumentJson: string;
};

export function resolveFlushedDocumentJson(
  input: FlushDocumentSnapshotInput,
): string {
  if (input.skipNameCommit) {
    return input.currentDocumentJson;
  }
  const trimmed = input.nameDraft.trim() || "Untitled";
  if (input.nameDraftDirty && trimmed !== input.projectName) {
    return input.renamedDocumentJson ?? input.currentDocumentJson;
  }
  return input.currentDocumentJson;
}
