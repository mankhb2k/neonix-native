import { describe, expect, it } from "vitest";
import {
  selectionClips,
  selectionNone,
  selectionNode,
  selectedClipIdsFrom,
  selectedNodeIdFrom,
  selectedOverlayIdFrom,
  selectedRootLayerIdFrom,
} from "@motionvideo/editor-core";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";

const lanes: TimelineLane[] = [
  {
    id: "base",
    kind: "visual",
    role: "base",
    order: -1,
    name: "Main",
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
  {
    id: "ov",
    kind: "visual",
    role: "overlay",
    order: 0,
    name: "Lớp 1",
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
];

const clips: TimelineClip[] = [
  {
    id: "c1",
    kind: "scene",
    sceneId: "s1",
    laneId: "base",
    startTime: 0,
    duration: 2,
    name: "A",
  },
  {
    id: "c2",
    kind: "scene",
    sceneId: "s2",
    laneId: "ov",
    startTime: 0,
    duration: 1,
    name: "B",
  },
];

describe("EditorSelection", () => {
  it("selectionClips dedupes and picks primary", () => {
    const sel = selectionClips(["a", "a", "b"], "a");
    expect(sel).toEqual({ kind: "clips", ids: ["a", "b"], primaryId: "a" });
    expect(selectionClips([])).toEqual(selectionNone());
  });

  it("derives rootLayerId from base clip selection", () => {
    const sel = selectionClips(["c1"]);
    expect(selectedRootLayerIdFrom(sel, clips)).toBe("s1");
    expect(selectedOverlayIdFrom(sel, clips, lanes)).toBeNull();
  });

  it("derives overlay id and rootLayerId from overlay clip selection", () => {
    const sel = selectionClips(["c2"]);
    expect(selectedRootLayerIdFrom(sel, clips)).toBe("s2");
    expect(selectedOverlayIdFrom(sel, clips, lanes)).toBe("c2");
  });

  it("node selection is a pure layerId (no root layer)", () => {
    const sel = selectionNode("n1");
    expect(sel).toEqual({ kind: "node", layerId: "n1" });
    expect(selectedNodeIdFrom(sel)).toBe("n1");
    expect(selectedRootLayerIdFrom(sel, clips)).toBeNull();
    expect(selectedClipIdsFrom(sel)).toEqual([]);
  });
});
