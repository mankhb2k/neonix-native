import { describe, expect, it } from "vitest";
import { sliceScene, clipLocalTime } from "@motionvideo/editor-core";
import type { MotionLayer } from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";

function makeTextChild(
  id: string,
  parentId: string,
  start: number,
  duration: number,
): MotionLayer {
  return {
    id,
    type: "text",
    name: id,
    parentLayerId: parentId,
    zIndex: 0,
    ...visualLayerAtoms({ width: 100, height: 40 }),
    timing: { start, duration },
    payload: {
      text: id,
      fontSize: 20,
      color: "#000000",
      alignment: "left",
    },
  } as unknown as MotionLayer;
}

function makeGroupScene(children: MotionLayer[]): MotionLayer {
  return {
    id: "s1",
    type: "group",
    name: "S",
    parentLayerId: null,
    zIndex: 0,
    ...visualLayerAtoms({ width: 1920, height: 1080 }),
    timing: { start: 0, duration: 6 },
    children,
  } as unknown as MotionLayer;
}

describe("sliceScene", () => {
  it("resets timing to a local [0, duration) window", () => {
    const scene = {
      id: "s1",
      type: "group",
      name: "S",
      parentLayerId: null,
      zIndex: 0,
      frame: { width: 1920, height: 1080 },
      transform: {
        translate: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotate: { z: 0 },
        skew: { x: 0, y: 0 },
        origin: { x: 0.5, y: 0.5 },
        depth: 0,
      },
      appearance: { visible: true, opacity: 100 },
      timing: { start: 0, duration: 5 },
      children: [],
    } as unknown as MotionLayer;

    const sliced = sliceScene(scene, 2, 2);
    expect(sliced.timing).toEqual({ start: 0, duration: 2 });
  });

  it("applies localStart: shifts child timing and drops out-of-window children", () => {
    const scene = makeGroupScene([
      // ends at 1.5 — entirely before the [2, 4) window → dropped
      makeTextChild("early", "s1", 0, 1.5),
      // 3..5 — intersects the window → start shifts to 1, duration clamps to 1
      makeTextChild("mid", "s1", 3, 2),
      // 5..6 — entirely after the window → dropped
      makeTextChild("late", "s1", 5, 1),
    ]);

    const sliced = sliceScene(scene, 2, 2);
    expect(sliced.type).toBe("group");
    if (sliced.type !== "group") return;
    expect(sliced.children.map((c) => c.id)).toEqual(["mid"]);
    expect(sliced.children[0]?.timing).toEqual({ start: 1, duration: 1 });
  });

  it("localStart=2 differs from localStart=0", () => {
    const scene = makeGroupScene([
      makeTextChild("first", "s1", 0, 2), // 0..2
      makeTextChild("second", "s1", 2, 2), // 2..4
    ]);

    const atZero = sliceScene(scene, 0, 2);
    const atTwo = sliceScene(scene, 2, 2);
    expect(atZero.type).toBe("group");
    expect(atTwo.type).toBe("group");
    if (atZero.type !== "group" || atTwo.type !== "group") return;

    // localStart=0 exposes the first child; localStart=2 exposes the second.
    expect(atZero.children.map((c) => c.id)).toEqual(["first"]);
    expect(atTwo.children.map((c) => c.id)).toEqual(["second"]);
    expect(atTwo).not.toEqual(atZero);
  });

  it("slices nested groups with child-local timing (no over-shift)", () => {
    // Nested group at root-local 2..6, grandchild at group-local 1..3
    // (absolute 3..5). Slicing the root at [2, 4) must keep the grandchild at
    // group-local start 1, NOT shift it by the root's localStart again.
    const nested: MotionLayer = {
      id: "g",
      type: "group",
      name: "g",
      parentLayerId: "s1",
      zIndex: 0,
      ...visualLayerAtoms({ width: 1920, height: 1080 }),
      timing: { start: 2, duration: 4 },
      children: [makeTextChild("t", "g", 1, 2)],
    } as unknown as MotionLayer;

    const scene = makeGroupScene([nested]);
    const sliced = sliceScene(scene, 2, 2);
    expect(sliced.type).toBe("group");
    if (sliced.type !== "group") return;
    const slicedNested = sliced.children[0];
    expect(slicedNested?.type).toBe("group");
    if (slicedNested?.type !== "group") return;
    // Nested group shifts to 0 (2 - 2); grandchild stays at group-local 1.
    expect(slicedNested.timing).toEqual({ start: 0, duration: 2 });
    expect(slicedNested.children[0]?.timing).toEqual({ start: 1, duration: 1 });
  });

  it("re-bases a nested group that starts BEFORE the window (childWindowStart > 0)", () => {
    // Group g occupies root [0, 10); grandchild t occupies g-local [3, 7)
    // (root [3, 7)). Slicing the root at [5, 8) must re-base t from g-local
    // 5 → output 0 (childWindowStart = 5 - 0 = 5), NOT drop/over-shift it.
    const nested: MotionLayer = {
      id: "g",
      type: "group",
      name: "g",
      parentLayerId: "s1",
      zIndex: 0,
      ...visualLayerAtoms({ width: 1920, height: 1080 }),
      timing: { start: 0, duration: 10 },
      children: [makeTextChild("t", "g", 3, 4)],
    } as unknown as MotionLayer;

    const scene = makeGroupScene([nested]);
    const sliced = sliceScene(scene, 5, 3);
    expect(sliced.type).toBe("group");
    if (sliced.type !== "group") return;
    const slicedNested = sliced.children[0];
    expect(slicedNested?.type).toBe("group");
    if (slicedNested?.type !== "group") return;
    // g clips to [0, 3); grandchild re-bases from g-local 5 to 0 (duration 2).
    expect(slicedNested.timing).toEqual({ start: 0, duration: 3 });
    expect(slicedNested.children[0]?.timing).toEqual({ start: 0, duration: 2 });
  });

  it("re-bases deeply nested groups (3 levels) with child-local timing", () => {
    // root → g1 (0..10) → g2 (g1-local 3..8) → t (g2-local 1..3 = root 4..6).
    // Slicing [2, 7) keeps t at output local 2.
    const g2: MotionLayer = {
      id: "g2",
      type: "group",
      name: "g2",
      parentLayerId: "g1",
      zIndex: 0,
      ...visualLayerAtoms({ width: 1920, height: 1080 }),
      timing: { start: 3, duration: 5 },
      children: [makeTextChild("t", "g2", 1, 2)],
    } as unknown as MotionLayer;
    const g1: MotionLayer = {
      id: "g1",
      type: "group",
      name: "g1",
      parentLayerId: "s1",
      zIndex: 0,
      ...visualLayerAtoms({ width: 1920, height: 1080 }),
      timing: { start: 0, duration: 10 },
      children: [g2],
    } as unknown as MotionLayer;

    const scene = makeGroupScene([g1]);
    const sliced = sliceScene(scene, 2, 5);
    expect(sliced.type).toBe("group");
    if (sliced.type !== "group") return;
    const sG1 = sliced.children[0];
    expect(sG1?.type).toBe("group");
    if (sG1?.type !== "group") return;
    const sG2 = sG1.children[0];
    expect(sG2?.type).toBe("group");
    if (sG2?.type !== "group") return;
    // g1 → {0, 5}; g2 (g1-local 3) → {1, 4}; t (g2-local 1) → {1, 2}.
    expect(sG1.timing).toEqual({ start: 0, duration: 5 });
    expect(sG2.timing).toEqual({ start: 1, duration: 4 });
    expect(sG2.children[0]?.timing).toEqual({ start: 1, duration: 2 });
  });

  it("clipLocalTime matches preview semantics", () => {
    expect(clipLocalTime(1, 4, 1)).toBeCloseTo(0);
    expect(clipLocalTime(1, 4, 3)).toBeCloseTo(2);
    expect(clipLocalTime(1, 4, 5)).toBeCloseTo(4 - 1e-6);
  });
});
