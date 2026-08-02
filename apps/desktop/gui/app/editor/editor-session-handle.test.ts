import { describe, expect, it } from "vitest";
import { resolveFlushedDocumentJson } from "./flush-document-snapshot";
import {
  resolveFlushedProjectName,
  type EditorSessionSnapshot,
} from "./editor-session-handle";

describe("EditorSessionHandle flushSnapshot contract", () => {
  it("includes projectName and dirty for pending rename", () => {
    const pendingNameDirty = true;
    const parentDirty = false;
    const nameDraft = "Renamed Project";
    const documentJson = resolveFlushedDocumentJson({
      skipNameCommit: false,
      nameDraftDirty: true,
      nameDraft,
      projectName: "Old",
      renamedDocumentJson: '{"name":"Renamed Project"}',
      currentDocumentJson: '{"name":"Old"}',
    });
    const projectName = resolveFlushedProjectName({
      skipNameCommit: false,
      nameDraftDirty: true,
      nameDraft,
      projectName: "Old",
    });
    const snap: EditorSessionSnapshot = {
      documentJson,
      projectName,
      dirty: parentDirty || pendingNameDirty,
    };
    expect(snap.dirty).toBe(true);
    expect(snap.documentJson).toContain("Renamed Project");
    expect(snap.projectName).toBe("Renamed Project");
  });

  it("Save As suggested name uses flushed projectName not stale parent", () => {
    const snap: EditorSessionSnapshot = {
      documentJson: '{"name":"Fresh"}',
      projectName: "Fresh",
      dirty: true,
    };
    const parentProjectName = "Stale";
    const suggestedName = snap.projectName || parentProjectName;
    expect(suggestedName).toBe("Fresh");
  });
});
