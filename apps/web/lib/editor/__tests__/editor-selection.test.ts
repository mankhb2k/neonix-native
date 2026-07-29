import { describe, expect, it } from "vitest";
import {
  selectionClips,
  selectionNone,
  selectionNode,
  selectedClipIdsFrom,
  selectedOverlayIdFrom,
  selectedSceneIdFrom,
} from "@/lib/editor/model/editor-selection";
import { DEFAULT_VISUAL_POLICY, type TimelineClip, type TimelineLane } from "@/lib/editor/timeline-clips";

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

  it("derives sceneId from base clip selection", () => {
    const sel = selectionClips(["c1"]);
    expect(selectedSceneIdFrom(sel, clips, lanes)).toBe("s1");
    expect(selectedOverlayIdFrom(sel, clips, lanes)).toBeNull();
  });

  it("derives overlay id from overlay clip selection", () => {
    const sel = selectionClips(["c2"]);
    expect(selectedSceneIdFrom(sel, clips, lanes)).toBeNull();
    expect(selectedOverlayIdFrom(sel, clips, lanes)).toBe("c2");
  });

  it("node selection exposes sceneId directly", () => {
    const sel = selectionNode("s1", "n1");
    expect(selectedSceneIdFrom(sel, clips, lanes)).toBe("s1");
    expect(selectedClipIdsFrom(sel)).toEqual([]);
  });
});
