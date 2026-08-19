import { describe, expect, it } from "vitest";
import {
  fixtureBasePlusOverlay,
  fixtureMainOnly,
} from "../testing/fixtures/projects";
import {
  executeTimelineCommand,
  groupPathToTimelineClips,
  validateTimelineDocument,
  type TimelineDocument,
} from "..";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/patterns";

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

  it("executes add-scene-node into an existing scene (layer mode)", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const sourceScene = project.layers[0]!;
    const sceneId = sourceScene.id;
    const beforeCount =
      sourceScene.type === "group" ? sourceScene.children.length : 0;

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
    const scene = result.document.project.layers.find((s) => s.id === sceneId)!;
    const children = scene.type === "group" ? scene.children : [];
    expect(children.length).toBe(beforeCount + 1);
    const added = children[children.length - 1]!;
    expect(added.zIndex).toBe(3);
    expect(added.timing).toEqual({ start: 0.5, duration: 1.5 });
    expect(result.selection?.kind).toBe("node");
    expect(result.events.some((e) => e.type === "scene-node-added")).toBe(true);
  });

  it("executes add-scene-node into a group with parent-relative timing and sibling zIndex", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const scene = project.layers[0]!;
    if (scene.type !== "group") throw new Error("expected group scene");
    scene.timing.duration = 10;
    scene.children = [
      {
        id: "group.char",
        type: "group",
        parentLayerId: scene.id,
        zIndex: 0,
        timing: { start: 5, duration: 2 },
        ...visualLayerAtoms({ width: 1920, height: 1080 }),
        children: [
          {
            id: "child.existing",
            type: "text",
            parentLayerId: "group.char",
            zIndex: 1,
            timing: { start: 0, duration: 2 },
            ...visualLayerAtoms({ width: 200, height: 40 }),
            payload: {
              text: "Child",
              fontSize: 12,
              color: "#111111",
              alignment: "left",
              wrap: "word",
              overflow: "visible",
            },
          },
        ],
      },
      {
        id: "root.title",
        type: "text",
        parentLayerId: scene.id,
        zIndex: 99,
        timing: { start: 0, duration: 10 },
        ...visualLayerAtoms({ width: 200, height: 40 }),
        payload: {
          text: "Root",
          fontSize: 12,
          color: "#111111",
          alignment: "left",
          wrap: "word",
          overflow: "visible",
        },
      },
    ];
    const doc: TimelineDocument = { project, clips, lanes };

    const result = executeTimelineCommand(doc, {
      type: "add-scene-node",
      sceneId: scene.id,
      draft: {
        id: "draft.child",
        name: "Child",
        text: "Hello",
        duration: 5,
        kind: "text",
      },
      parentLayerId: "group.char",
      timing: { start: 1.5, duration: 5 },
    });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    const resultScene = result.document.project.layers[0]!;
    const group =
      resultScene.type === "group"
        ? resultScene.children.find((n) => n.id === "group.char")
        : undefined;
    const added = group?.type === "group" ? group.children.at(-1)! : null;
    expect(added?.parentLayerId).toBe("group.char");
    expect(added?.zIndex).toBe(2);
    expect(added?.timing).toEqual({ start: 1.5, duration: 0.5 });
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
        shape: "rectangle",
      },
      target: { track: "main" },
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      const scene = result.document.project.layers.at(-1);
      const node = scene?.type === "group" ? scene.children[0] : scene;
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
      const scene = result.document.project.layers.at(-1);
      const node = scene?.type === "group" ? scene.children[0] : scene;
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
    const result = executeTimelineCommand(
      { project, clips, lanes },
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
      const scene = result.document.project.layers.at(-1);
      const node = scene?.type === "group" ? scene.children[0] : scene;
      expect(node && "transform" in node ? node.transform.translate.x : 0).toBe(
        960,
      );
      expect(node && "transform" in node ? node.transform.translate.y : 0).toBe(
        540,
      );
    }
  });

  it("exclusiveRows swaps group children instead of packing one row", () => {
    const atoms = visualLayerAtoms({ width: 1920, height: 1080 });
    const textAtoms = visualLayerAtoms({ width: 200, height: 40 });
    const textPayload = {
      text: "T",
      fontSize: 24,
      color: "#111111",
      alignment: "left" as const,
    };
    const project = parseMotionProjectV1({
      format: "motion-project",
      formatVersion: 1,
      metadata: { id: "swap-test", name: "Swap", locale: "vi-VN" },
      composition: { width: 1920, height: 1080, fps: 30 },
      assets: [],
      components: [],
      layers: [
        {
          id: "hero",
          type: "group",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 8 },
          ...atoms,
          children: [
            {
              id: "title",
              type: "text",
              parentLayerId: "hero",
              zIndex: 0,
              timing: { start: 0, duration: 2 },
              ...textAtoms,
              payload: { ...textPayload, text: "Title" },
            },
            {
              id: "sub",
              type: "text",
              parentLayerId: "hero",
              zIndex: 1,
              timing: { start: 3, duration: 2 },
              ...textAtoms,
              payload: { ...textPayload, text: "Sub" },
            },
          ],
        },
      ],
    });
    const surface = groupPathToTimelineClips(project, ["hero"]);
    const title = surface.clips.find((c) => c.id === "title");
    const sub = surface.clips.find((c) => c.id === "sub");
    expect(title?.laneId).toBe("lane.main");
    expect(sub?.laneId).toBe("lane.overlay.0");

    const result = executeTimelineCommand(
      { project, clips: surface.clips, lanes: surface.lanes },
      {
        type: "move-clip",
        clipId: "sub",
        patch: {
          startTime: sub!.startTime,
          track: "main",
          laneId: title!.laneId,
          exclusiveRows: true,
          swapClipId: "title",
        },
      },
    );
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(validateTimelineDocument(result.document).valid).toBe(true);
    const hero = result.document.project.layers.find((l) => l.id === "hero");
    expect(hero?.type).toBe("group");
    if (hero?.type !== "group") return;
    const z = Object.fromEntries(hero.children.map((c) => [c.id, c.zIndex]));
    expect(z.sub).toBe(0);
    expect(z.title).toBe(1);
    expect(new Set(Object.values(z)).size).toBe(2);
  });
});
