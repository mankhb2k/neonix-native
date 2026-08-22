import { describe, expect, it } from "vitest";
import {
  applyMockEditorCommand,
  createMockEditorState,
  createOverlapEditorDocument,
  createRectangleEditorDocument,
  previewMockDocument,
  unavailableMockExport,
} from "./index";

describe("mock editor core", () => {
  it("creates deterministic fixtures without protocol-shaped data", () => {
    expect(createRectangleEditorDocument()).toEqual(createRectangleEditorDocument());
    const overlap = createOverlapEditorDocument();
    expect(overlap.lanes.map((lane) => lane.id)).toEqual(["lane.main", "lane.overlay.0"]);
  });

  it("applies selection and clamps seek without mutating input", () => {
    const state = createMockEditorState();
    const selected = applyMockEditorCommand(state, {
      type: "selection/set",
      selection: { kind: "node", nodeId: "node.rectangle" },
    });
    expect(selected.status).toBe("applied");
    if (selected.status !== "applied") return;
    expect(selected.state.selection).toEqual({ kind: "node", nodeId: "node.rectangle" });
    expect(state.selection).toEqual({ kind: "none" });
    const seek = applyMockEditorCommand(selected.state, { type: "playback/seek", time: 999 });
    expect(seek.status).toBe("applied");
    if (seek.status === "applied") expect(seek.state.playheadTime).toBe(5);
  });

  it("moves a clip with lane validation", () => {
    const state = createMockEditorState(createOverlapEditorDocument());
    const moved = applyMockEditorCommand(state, {
      type: "timeline/move-clip",
      clipId: "clip.title",
      laneId: "lane.main",
      startTime: 2,
    });
    expect(moved.status).toBe("applied");
    if (moved.status === "applied") {
      expect(moved.state.document.clips.find((clip) => clip.id === "clip.title")?.startTime).toBe(2);
    }
    const invalid = applyMockEditorCommand(state, {
      type: "timeline/move-clip",
      clipId: "clip.title",
      laneId: "missing",
      startTime: 0,
    });
    expect(invalid.status).toBe("rejected");
  });

  it("returns explicit unsupported mock export and mock preview", () => {
    const state = createMockEditorState();
    const exportResult = applyMockEditorCommand(state, {
      type: "export/request",
      request: { format: "mp4" },
    });
    expect(exportResult.status).toBe("unsupported");
    expect(unavailableMockExport().status).toBe("unavailable");
    const preview = previewMockDocument(state.document, 1);
    expect(preview.status).toBe("mock");
    if (preview.status === "mock") expect(preview.frame.nodes).toHaveLength(1);
  });
});
