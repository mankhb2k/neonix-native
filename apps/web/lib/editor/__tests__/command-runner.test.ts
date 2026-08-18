import { describe, expect, it } from "vitest";
import {
  fixtureBasePlusOverlay,
  fixtureMainOnly,
} from "@/lib/editor/__fixtures__/projects";
import { createEditorStore } from "@/lib/editor/store/create-editor-store";
import {
  documentFromStoreState,
  executeTimelineCommand,
  validateTimelineDocument,
  type TimelineDocument,
} from "@motionvideo/editor-core";

describe("Pure Command Runner Engine", () => {
  it("executes update-scene-duration command atomically", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };

    const result = executeTimelineCommand(doc, {
      type: "update-scene-duration",
      sceneId: "scene.main.a",
      duration: 10,
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(validateTimelineDocument(result.document).valid).toBe(true);
      const updatedScene = result.document.project.layers.find(
        (s) => s.id === "scene.main.a",
      );
      expect(updatedScene?.timing.duration).toBe(10);
      expect(result.events.some((e) => e.type === "document-rebuilt")).toBe(
        true,
      );
    }
  });

  it("executes add-clip-draft on main track", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };

    const result = executeTimelineCommand(doc, {
      type: "add-clip-draft",
      draft: { id: "draft.1", name: "New Frame", text: "Text", duration: 4 },
      target: { track: "main", startTime: 0 },
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(validateTimelineDocument(result.document).valid).toBe(true);
      expect(result.document.clips.length).toBe(clips.length + 1);
      expect(result.events.some((e) => e.type === "clip-added")).toBe(true);
    }
  });

  it("executes move-clip to overlay lane", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };

    const result = executeTimelineCommand(doc, {
      type: "move-clip",
      clipId: "clip.main.b",
      patch: { track: "overlay", startTime: 1, insertNewLane: true },
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(validateTimelineDocument(result.document).valid).toBe(true);
      const moved = result.document.clips.find((c) => c.id === "clip.main.b");
      expect(moved?.startTime).toBe(1);
      expect(result.events.some((e) => e.type === "clip-moved")).toBe(true);
    }
  });

  it("executes delete-selected-clips command", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const doc: TimelineDocument = { project, clips, lanes };
    const selection = {
      kind: "clips" as const,
      ids: ["clip.overlay"],
      primaryId: "clip.overlay",
    };

    const result = executeTimelineCommand(
      doc,
      { type: "delete-selected-clips" },
      selection,
    );

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(validateTimelineDocument(result.document).valid).toBe(true);
      expect(result.document.clips.some((c) => c.id === "clip.overlay")).toBe(
        false,
      );
      expect(result.events.some((e) => e.type === "clip-deleted")).toBe(true);
    }
  });

  it("executes update-lane-flags command", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };

    const result = executeTimelineCommand(doc, {
      type: "update-lane-flags",
      laneId: "lane.main",
      patch: { locked: true },
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(validateTimelineDocument(result.document).valid).toBe(true);
      const mainLane = result.document.lanes.find((l) => l.id === "lane.main");
      expect(mainLane?.locked).toBe(true);
    }
  });

  it("rejects move-clip on locked lane", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const lockedLanes = lanes.map((l) => ({ ...l, locked: true }));
    const doc: TimelineDocument = { project, clips, lanes: lockedLanes };

    const result = executeTimelineCommand(doc, {
      type: "move-clip",
      clipId: "clip.main.a",
      patch: { startTime: 5 },
    });

    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.reason).toBe("locked");
    }
  });
});

describe("Store Integration & Factory Isolation", () => {
  it("creates isolated store instances without singleton state sharing", () => {
    const store1 = createEditorStore();
    const store2 = createEditorStore();

    const { project, clips, lanes, overlayScenes } = fixtureMainOnly();
    store1.getState().loadProject(project, overlayScenes, clips, lanes);

    expect(store1.getState().project).not.toBeNull();
    expect(store2.getState().project).toBeNull();
  });

  it("executes commands via store.executeTimelineCommand", () => {
    const store = createEditorStore();
    const { project, clips, lanes, overlayScenes } = fixtureMainOnly();
    store.getState().loadProject(project, overlayScenes, clips, lanes);

    const res = store.getState().executeTimelineCommand({
      type: "update-scene-duration",
      sceneId: "scene.main.a",
      duration: 8,
    });

    expect(res.status).toBe("applied");
    const updatedProject = store.getState().project;
    const sceneA = updatedProject?.layers.find((s) => s.id === "scene.main.a");
    expect(sceneA?.timing.duration).toBe(8);
  });
});
