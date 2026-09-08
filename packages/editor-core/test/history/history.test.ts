import { describe, expect, it } from "vitest";
import type { EditorCommand } from "../../src/document/commands";
import type { EditorHistoryEntry } from "../../src/history";
import {
  MAX_HISTORY_BYTES,
  MAX_HISTORY_ENTRIES,
  appendOrCoalesceUndoEntry,
  appendRedoEntry,
  appendUndoEntry,
  estimateHistoryBytes,
  trimHistory,
} from "../../src/history";

function entry(id: number, payload = ""): EditorHistoryEntry {
  const command = { id, payload } as unknown as EditorCommand;
  return {
    id: `test-${id}`,
    label: "Test command",
    timestamp: id,
    undo: [command],
    redo: [command],
    selectionBefore: [],
    selectionAfter: [],
  };
}

describe("history policy", () => {
  it("limits each stack to 50 newest entries by default", () => {
    const entries = Array.from({ length: 75 }, (_, id) => entry(id));
    const trimmed = trimHistory(entries);

    expect(MAX_HISTORY_ENTRIES).toBe(50);
    expect(trimmed).toHaveLength(50);
    expect((trimmed[0]!.undo[0] as unknown as { id: number }).id).toBe(25);
    expect((trimmed.at(-1)!.undo[0] as unknown as { id: number }).id).toBe(74);
  });

  it("enforces the byte budget while keeping the newest command", () => {
    const entries = [entry(1, "a".repeat(200)), entry(2, "b".repeat(200)), entry(3, "c")];
    const trimmed = trimHistory(entries, { maxEntries: 50, maxBytes: 500 });

    expect(trimmed).toHaveLength(1);
    expect((trimmed[0]!.undo[0] as unknown as { id: number }).id).toBe(3);
    expect(estimateHistoryBytes(trimmed[0])).toBeLessThanOrEqual(MAX_HISTORY_BYTES);
  });

  it("coalesces the redo command without replacing the original undo", () => {
    const original = entry(1, "original");
    const latest = entry(2, "latest");
    const coalesced = appendOrCoalesceUndoEntry([original], "drag:shape", "drag:shape", latest);

    expect(coalesced).toHaveLength(1);
    expect((coalesced[0]!.undo[0] as unknown as { id: number }).id).toBe(1);
    expect((coalesced[0]!.redo[0] as unknown as { id: number }).id).toBe(2);
  });

  it("starts a new entry when the coalescing key changes", () => {
    const next = appendOrCoalesceUndoEntry(
      [entry(1)],
      "drag:shape",
      "drag:other",
      entry(2),
    );

    expect(next).toHaveLength(2);
  });

  it("applies the same count/byte policy to redo entries", () => {
    let redo: readonly EditorHistoryEntry[] = [];
    for (let id = 0; id < 60; id += 1) redo = appendRedoEntry(redo, entry(id));
    expect(redo).toHaveLength(50);

    let undo: readonly EditorHistoryEntry[] = [];
    for (let id = 0; id < 60; id += 1) undo = appendUndoEntry(undo, entry(id));
    expect(undo).toHaveLength(50);
  });
});
