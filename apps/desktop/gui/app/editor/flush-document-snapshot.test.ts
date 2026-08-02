import { describe, expect, it } from "vitest";
import { resolveFlushedDocumentJson } from "./flush-document-snapshot";

describe("resolveFlushedDocumentJson", () => {
  it("returns renamed snapshot when name draft is dirty", () => {
    const json = resolveFlushedDocumentJson({
      skipNameCommit: false,
      nameDraftDirty: true,
      nameDraft: "Renamed Project",
      projectName: "Old",
      renamedDocumentJson: '{"name":"Renamed Project"}',
      currentDocumentJson: '{"name":"Old"}',
    });
    expect(json).toBe('{"name":"Renamed Project"}');
  });

  it("keeps current JSON when Escape skipped commit", () => {
    const json = resolveFlushedDocumentJson({
      skipNameCommit: true,
      nameDraftDirty: true,
      nameDraft: "Should Ignore",
      projectName: "Old",
      renamedDocumentJson: '{"name":"Should Ignore"}',
      currentDocumentJson: '{"name":"Old"}',
    });
    expect(json).toBe('{"name":"Old"}');
  });

  it("uses current JSON when draft matches project name", () => {
    const json = resolveFlushedDocumentJson({
      skipNameCommit: false,
      nameDraftDirty: true,
      nameDraft: "Same",
      projectName: "Same",
      renamedDocumentJson: null,
      currentDocumentJson: '{"name":"Same"}',
    });
    expect(json).toBe('{"name":"Same"}');
  });
});
