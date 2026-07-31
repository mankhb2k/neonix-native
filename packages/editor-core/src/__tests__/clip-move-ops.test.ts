import { describe, expect, it } from "vitest";
import {
  applyRippleAfter,
  resolveVisualPlacement,
} from "../operations/clip-move";
import {
  DEFAULT_VISUAL_POLICY,
  resolveLaneStartTimeNearest,
  type TimelineClip,
  type TimelineLane,
} from "../timeline/timeline-clips";

const lanes: TimelineLane[] = [
  {
    id: "lane.main",
    kind: "visual",
    role: "base",
    name: "Main",
    order: -1,
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
  {
    id: "lane.ov.0",
    kind: "visual",
    role: "overlay",
    name: "Lớp 1",
    order: 0,
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
  {
    id: "lane.ov.1",
    kind: "visual",
    role: "overlay",
    name: "Lớp 2",
    order: 1,
    policy: { ...DEFAULT_VISUAL_POLICY },
  },
];

const clips: TimelineClip[] = [
  {
    id: "c1",
    kind: "scene",
    sceneId: "s1",
    laneId: "lane.main",
    startTime: 0,
    duration: 2,
    name: "A",
  },
  {
    id: "c2",
    kind: "scene",
    sceneId: "s2",
    laneId: "lane.main",
    startTime: 2,
    duration: 2,
    name: "B",
  },
];

describe("resolveLaneStartTimeNearest", () => {
  const onLane: TimelineClip[] = [
    {
      id: "x",
      kind: "scene",
      sceneId: "sx",
      laneId: "lane.ov.0",
      startTime: 2,
      duration: 3,
      name: "X",
    },
  ];

  it("keeps desired when free", () => {
    expect(resolveLaneStartTimeNearest(onLane, 0, 1.5)).toBe(0);
  });

  it("snaps to nearer candidate start (before vs after)", () => {
    // before=0 dist 2.2; after=5 dist 2.8 → before
    expect(resolveLaneStartTimeNearest(onLane, 2.2, 2)).toBe(0);
  });

  it("snaps after when after candidate is nearer", () => {
    // before=0 dist 4.5; after=5 dist 0.5 → after
    expect(resolveLaneStartTimeNearest(onLane, 4.5, 2)).toBe(5);
  });

  it("long moving clip prefers after when nearer than before=0", () => {
    const blocker: TimelineClip[] = [
      {
        id: "b",
        kind: "scene",
        sceneId: "sb",
        laneId: "lane.ov.0",
        startTime: 10,
        duration: 1,
        name: "B",
      },
    ];
    // before=0 dist 10.4; after=11 dist 0.6 → 11
    expect(resolveLaneStartTimeNearest(blocker, 10.4, 10)).toBe(11);
  });
});

describe("visual clip placement operations", () => {
  it("pushes main placement with nearest-snap", () => {
    const placed = resolveVisualPlacement(lanes, clips, {
      type: "base",
      startTime: 1,
      duration: 2,
    });
    expect(placed.status).toBe("placed");
    if (placed.status !== "placed") return;
    expect(placed.laneId).toBe("lane.main");
    // [0,2)+[2,4) đầy → snap sau chuỗi = 4
    expect(placed.startTime).toBe(4);
  });

  it("new-overlay-lane creates lane at insertOrder (bug1 regression)", () => {
    const placed = resolveVisualPlacement(lanes, clips, {
      type: "new-overlay-lane",
      insertOrder: 1,
      startTime: 0.5,
      duration: 2,
    });
    expect(placed).toEqual({
      status: "create-lane",
      insertOrder: 1,
      startTime: 0.5,
    });
  });

  it("overlay-lane free keeps lane and time", () => {
    const placed = resolveVisualPlacement(lanes, clips, {
      type: "overlay-lane",
      laneId: "lane.ov.0",
      startTime: 1,
      duration: 2,
    });
    expect(placed).toEqual({
      status: "placed",
      laneId: "lane.ov.0",
      startTime: 1,
    });
  });

  it("overlay collision keeps target lane — does not fall back to source", () => {
    const withOv: TimelineClip[] = [
      ...clips,
      {
        id: "moving",
        kind: "scene",
        sceneId: "sm",
        laneId: "lane.ov.0",
        startTime: 0,
        duration: 3,
        name: "Moving",
      },
      {
        id: "blocker",
        kind: "scene",
        sceneId: "sb",
        laneId: "lane.ov.1",
        startTime: 0,
        duration: 3,
        name: "Blocker",
      },
    ];
    const placed = resolveVisualPlacement(
      lanes,
      withOv,
      {
        type: "overlay-lane",
        laneId: "lane.ov.1",
        startTime: 0,
        duration: 3,
      },
      "moving",
    );
    expect(placed.status).toBe("placed");
    if (placed.status !== "placed") return;
    expect(placed.laneId).toBe("lane.ov.1");
    expect(placed.laneId).not.toBe("lane.ov.0");
    // Snap after blocker → 3
    expect(placed.startTime).toBe(3);
  });

  it("locked overlay target is blocked", () => {
    const lockedLanes = lanes.map((lane) =>
      lane.id === "lane.ov.0" ? { ...lane, locked: true } : lane,
    );
    const placed = resolveVisualPlacement(lockedLanes, clips, {
      type: "overlay-lane",
      laneId: "lane.ov.0",
      startTime: 0,
      duration: 1,
    });
    expect(placed).toEqual({ status: "blocked", reason: "locked" });
  });

  it("ripple off keeps absolute times", () => {
    const next = applyRippleAfter(clips, "lane.main", 2, 1, false);
    expect(next).toEqual(clips);
  });

  it("ripple on shifts later clips", () => {
    const next = applyRippleAfter(clips, "lane.main", 2, 1, true);
    expect(next.find((c) => c.id === "c2")?.startTime).toBe(3);
    expect(next.find((c) => c.id === "c1")?.startTime).toBe(0);
  });
});
