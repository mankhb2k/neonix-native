import { describe, expect, it } from "vitest";
import { fixtureMainOnly } from "../testing/fixtures/projects";
import {
  createHistoryState,
  pushHistory,
  undoHistory,
  redoHistory,
  canUndo,
  canRedo,
  selectionClips,
  selectionNode,
  type HistoryEntry,
  type TimelineDocument,
} from "..";

describe("Pure History Manager Engine", () => {
  it("manages history push, undo, redo stack transitions correctly", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc1: TimelineDocument = { project, clips, lanes };
    const doc2: TimelineDocument = {
      project,
      clips: clips.map((c) => ({ ...c, duration: 10 })),
      lanes,
    };

    let state = createHistoryState(50);
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);

    state = pushHistory(state, {
      id: "h1",
      timestamp: Date.now(),
      label: "update-scene-duration",
      before: doc1,
      after: doc2,
    });

    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(false);

    const undoRes = undoHistory(state);
    expect(undoRes.entry?.before).toBe(doc1);
    state = undoRes.state;
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(true);

    const redoRes = redoHistory(state);
    expect(redoRes.entry?.after).toBe(doc2);
    state = redoRes.state;
    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(false);
  });

  it("enforces maxBudget memory limit", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };

    let state = createHistoryState(3);
    for (let i = 0; i < 10; i++) {
      state = pushHistory(state, {
        id: `h_${i}`,
        timestamp: Date.now(),
        label: `command_${i}`,
        before: doc,
        after: doc,
      });
    }

    expect(state.past.length).toBe(3);
    expect(state.past[0].id).toBe("h_7");
    expect(state.past[2].id).toBe("h_9");
  });

  it("carries beforeSelection/afterSelection through undo and redo", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const beforeSelection = selectionClips(["clip.main.a"]);
    const afterSelection = selectionNode("scene.main.a.title");
    const entry: HistoryEntry = {
      id: "h_sel",
      timestamp: Date.now(),
      label: "select-node",
      before: doc,
      after: doc,
      beforeSelection,
      afterSelection,
    };

    let state = pushHistory(createHistoryState(50), entry);

    const undoRes = undoHistory(state);
    expect(undoRes.entry?.beforeSelection).toBe(beforeSelection);
    expect(undoRes.entry?.afterSelection).toBe(afterSelection);
    state = undoRes.state;

    const redoRes = redoHistory(state);
    expect(redoRes.entry?.beforeSelection).toBe(beforeSelection);
    expect(redoRes.entry?.afterSelection).toBe(afterSelection);
  });

  it("restores selection to the redo target's beforeSelection on undo", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    // Two entries; undo of the second should surface its `beforeSelection`.
    let state = pushHistory(createHistoryState(50), {
      id: "h_first",
      timestamp: 1,
      label: "first",
      before: doc,
      after: doc,
      beforeSelection: selectionClips(["clip.main.a"]),
      afterSelection: selectionNode("scene.main.a.title"),
    });
    state = pushHistory(state, {
      id: "h_second",
      timestamp: 2,
      label: "second",
      before: doc,
      after: doc,
      beforeSelection: selectionNode("scene.main.b.title"),
      afterSelection: selectionClips(["clip.main.b"]),
    });

    const undoRes = undoHistory(state);
    // Undo target = most recent entry; its beforeSelection is the pre-state.
    expect(undoRes.entry?.beforeSelection).toEqual(
      selectionNode("scene.main.b.title"),
    );
    expect(undoRes.entry?.afterSelection).toEqual(
      selectionClips(["clip.main.b"]),
    );
  });
});
