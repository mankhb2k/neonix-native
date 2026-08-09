import { describe, expect, it } from "vitest";
import {
  fixtureBasePlusOverlay,
  fixtureMainOnly,
} from "@/lib/editor/__fixtures__/projects";
import { selectedClipIdsFrom } from "@motionvideo/editor-core";
import { createEditorStore } from "@/lib/editor/store/create-editor-store";
import {
  createHistoryState,
  pushHistory,
  undoHistory,
  redoHistory,
  canUndo,
  canRedo,
  type TimelineDocument,
} from "@motionvideo/editor-core";

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
});

describe("Store Undo/Redo Integration & Multi-Clip Delete", () => {
  it("executes undo and redo restoring document state & selection", () => {
    const store = createEditorStore();
    const { project, clips, lanes, overlayScenes } = fixtureBasePlusOverlay();
    store.getState().loadProject(project, overlayScenes, clips, lanes);

    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(false);

    // Thao tác 1: Move clip
    store.getState().moveClip("clip.overlay", { track: "overlay", startTime: 10 });

    expect(store.getState().canUndo).toBe(true);
    expect(store.getState().canRedo).toBe(false);
    const movedClip = store.getState().timelineClips.find((c) => c.id === "clip.overlay");
    expect(movedClip?.startTime).toBe(10);

    // Undo
    store.getState().undo();
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(true);
    const restoredClip = store.getState().timelineClips.find((c) => c.id === "clip.overlay");
    expect(restoredClip?.startTime).toBe(1);

    // Redo
    store.getState().redo();
    expect(store.getState().canUndo).toBe(true);
    expect(store.getState().canRedo).toBe(false);
    const reMovedClip = store.getState().timelineClips.find((c) => c.id === "clip.overlay");
    expect(reMovedClip?.startTime).toBe(10);
  });

  it("handles multi-clip delete with undo and redo", () => {
    const store = createEditorStore();
    const { project, clips, lanes, overlayScenes } = fixtureBasePlusOverlay();
    store.getState().loadProject(project, overlayScenes, clips, lanes);

    const countBefore = store.getState().timelineClips.length;
    store.getState().setSelectedClipIds(["clip.base", "clip.overlay"]);
    store.getState().deleteSelectedClips();

    expect(store.getState().timelineClips.length).toBe(countBefore - 2);
    expect(store.getState().canUndo).toBe(true);

    // Undo delete
    store.getState().undo();
    expect(store.getState().timelineClips.length).toBe(countBefore);
    expect(selectedClipIdsFrom(store.getState().selection)).toEqual(["clip.base", "clip.overlay"]);

    // Redo delete
    store.getState().redo();
    expect(store.getState().timelineClips.length).toBe(countBefore - 2);
  });

  it("resets history state atomically on loadProject", () => {
    const store = createEditorStore();
    const { project, clips, lanes, overlayScenes } = fixtureMainOnly();
    store.getState().loadProject(project, overlayScenes, clips, lanes);

    store.getState().moveClip("clip.main.a", { track: "main", startTime: 1 });
    expect(store.getState().canUndo).toBe(true);

    // Nạp dự án mới
    store.getState().loadProject(project, overlayScenes, clips, lanes);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(false);
  });
});
