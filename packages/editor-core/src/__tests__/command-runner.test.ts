import { describe, expect, it } from "vitest";
import {
  fixtureBasePlusOverlay,
  fixtureMainOnly,
} from "../testing/fixtures/projects";
import {
  executeTimelineCommand,
  validateTimelineDocument,
  type TimelineDocument,
} from "..";

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
      const updatedScene = result.document.project.scenes.find((s) => s.id === "scene.main.a");
      expect(updatedScene?.duration).toBe(10);
      expect(result.events.some((e) => e.type === "document-rebuilt")).toBe(true);
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

  it("executes add-scene-node into an existing scene (layer mode)", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const sceneId = project.scenes[0]!.id;
    const beforeCount = project.scenes[0]!.nodes.length;

    const result = executeTimelineCommand(doc, {
      type: "add-scene-node",
      sceneId,
      draft: {
        id: "draft.layer",
        name: "Layer Text",
        text: "Hello",
        duration: 2,
        kind: "text",
      },
      timing: { start: 0.5, duration: 1.5 },
      zIndex: 3,
    });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const scene = result.document.project.scenes.find((s) => s.id === sceneId)!;
    expect(scene.nodes.length).toBe(beforeCount + 1);
    const added = scene.nodes[scene.nodes.length - 1]!;
    expect(added.zIndex).toBe(3);
    expect(added.timing).toEqual({ start: 0.5, duration: 1.5 });
    expect(result.selection?.kind).toBe("node");
    expect(result.events.some((e) => e.type === "scene-node-added")).toBe(true);
  });

  it("add-clip-draft with shape kind emits a shape node", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };

    const result = executeTimelineCommand(doc, {
      type: "add-clip-draft",
      draft: {
        id: "draft.shape",
        name: "Rectangle",
        text: "Rectangle",
        duration: 3,
        kind: "shape",
        shape: "rect",
      },
      target: { track: "main" },
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      const scene = result.document.project.scenes.at(-1);
      const node = scene?.nodes[0];
      expect(node?.type).toBe("shape");
      if (node?.type === "shape") {
        expect(node.payload.shape).toBe("rectangle");
      }
    }
  });

  it("add-clip-draft with image kind emits an image node", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };

    const result = executeTimelineCommand(doc, {
      type: "add-clip-draft",
      draft: {
        id: "draft.img",
        name: "Photo",
        text: "Photo",
        duration: 3,
        kind: "image",
        assetId: "asset.photo",
      },
      target: { track: "main" },
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      const scene = result.document.project.scenes.at(-1);
      const node = scene?.nodes[0];
      expect(node?.type).toBe("image");
      if (node?.type === "image") {
        expect(node.payload.assetId).toBe("asset.photo");
      }
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
    const selection = { kind: "clips" as const, ids: ["clip.overlay"], primaryId: "clip.overlay" };

    const result = executeTimelineCommand(doc, { type: "delete-selected-clips" }, selection);

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(validateTimelineDocument(result.document).valid).toBe(true);
      expect(result.document.clips.some((c) => c.id === "clip.overlay")).toBe(false);
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

  it("rejects reorder-lane on base lane", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const base = lanes.find((l) => l.kind === "visual" && l.role === "base");
    expect(base).toBeTruthy();
    const result = executeTimelineCommand(
      { project, clips, lanes },
      { type: "reorder-lane", laneId: base!.id, newOrder: 0 },
    );
    expect(result.status).toBe("rejected");
  });

  it("centers new draft using project aspect ratio", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const wide = {
      ...project,
      metadata: { ...project.metadata, aspectRatio: "16:9" as const },
    };
    const result = executeTimelineCommand(
      { project: wide, clips, lanes },
      {
        type: "add-clip-draft",
        draft: {
          id: "d.center",
          name: "T",
          text: "T",
          duration: 2,
          kind: "text",
        },
        target: { track: "main" },
      },
    );
    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      const node = result.document.project.scenes.at(-1)?.nodes[0];
      expect(node?.transform.x).toBe(960);
      expect(node?.transform.y).toBe(540);
    }
  });
});
