import { describe, expect, it } from "vitest";
import { projectLayersToTimeline } from "@motionvideo/editor-core/v2";
import { applyV2EditorCommand } from "@motionvideo/editor-core/v2";
import { createV2EditorProject } from "./projects";
import { timelineCommandToV2 } from "../../components/editor/timeline/v2TimelineAdapter";

describe("V2 timeline adapter", () => {
  it("reorders a main layer when it is dropped onto an existing overlay lane", () => {
    const source = createV2EditorProject("shape").layers[0]!;
    const document = {
      ...createV2EditorProject("shape"),
      layers: [
        { ...source, id: "shape", order: 0 },
        { ...source, id: "shape-rectangle", order: 1 },
      ],
    };
    const projection = projectLayersToTimeline(document);
    const overlay = projection.lanes.find(
      (lane) => lane.kind === "visual" && lane.role === "overlay",
    );

    expect(overlay).toBeDefined();
    const next = timelineCommandToV2(document, projection, {
      type: "move-clip",
      clipId: "shape",
      patch: {
        startTime: 0,
        track: "overlay",
        laneId: overlay?.id ?? null,
      },
    });

    expect(next).toEqual({
      type: "reorder-layers",
      parentLayerId: null,
      orderedLayerIds: ["shape-rectangle", "shape"],
      patches: { shape: { timing: { start: 0, duration: source.timing.duration } } },
    });

    if (!next) return;
    const committed = applyV2EditorCommand(document, next);
    expect(committed.ok).toBe(true);
    if (committed.ok) {
      expect(
        committed.document.layers
          .slice()
          .sort((left, right) => left.order - right.order)
          .map((layer) => layer.id),
      ).toEqual(["shape-rectangle", "shape"]);
    }
  });

  it("uses the overlay lane identity even if the transient track is still main", () => {
    const base = createV2EditorProject("shape");
    const source = base.layers[0]!;
    const document = {
      ...base,
      layers: [
        { ...source, id: "shape", order: 0 },
        { ...source, id: "shape-rectangle", order: 1 },
      ],
    };
    const projection = projectLayersToTimeline(document);
    const overlay = projection.lanes.find(
      (lane) => lane.kind === "visual" && lane.role === "overlay",
    );
    expect(overlay).toBeDefined();

    const next = timelineCommandToV2(document, projection, {
      type: "move-clip",
      clipId: "shape",
      patch: {
        startTime: 0,
        track: "main",
        laneId: overlay?.id ?? null,
      },
    });

    expect(next && next.type === "reorder-layers" ? next.orderedLayerIds : null).toEqual([
      "shape-rectangle",
      "shape",
    ]);
  });

  it("reorders a selected block while applying its shared time delta", () => {
    const base = createV2EditorProject("shape");
    const source = base.layers[0]!;
    const document = {
      ...base,
      layers: [
        { ...source, id: "layer-0", order: 0 },
        { ...source, id: "layer-1", order: 1 },
        { ...source, id: "layer-2", order: 2 },
      ],
    };
    const projection = projectLayersToTimeline(document);
    const targetLane = projection.lanes.find((lane) => lane.order === 2)!;
    const next = timelineCommandToV2(document, projection, {
      type: "move-clips",
      clipIds: ["layer-0", "layer-1"],
      deltaTime: 1,
      targetLaneId: targetLane.id,
      targetTrack: "overlay",
    });

    expect(next).toMatchObject({
      type: "reorder-layers",
      orderedLayerIds: ["layer-2", "layer-0", "layer-1"],
      patches: {
        "layer-0": { timing: { start: 1 } },
        "layer-1": { timing: { start: 1 } },
      },
    });
  });
});
