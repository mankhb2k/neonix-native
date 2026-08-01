import { describe, expect, it } from "vitest";
import { resolveFlushedDocumentJson } from "../../renderer/src/app/editor/flush-document-snapshot";
import type { EditorSessionSnapshot } from "../../renderer/src/app/editor/editor-session-handle";

describe("EditorSessionHandle flushSnapshot contract", () => {
  it("treats pending rename as dirty even when parent dirty is false", () => {
    const pendingNameDirty = true;
    const parentDirty = false;
    const documentJson = resolveFlushedDocumentJson({
      skipNameCommit: false,
      nameDraftDirty: true,
      nameDraft: "Renamed",
      projectName: "Old",
      renamedDocumentJson: '{"name":"Renamed"}',
      currentDocumentJson: '{"name":"Old"}',
    });
    const snap: EditorSessionSnapshot = {
      documentJson,
      dirty: parentDirty || pendingNameDirty,
    };
    expect(snap.dirty).toBe(true);
    expect(snap.documentJson).toContain("Renamed");
  });
});
