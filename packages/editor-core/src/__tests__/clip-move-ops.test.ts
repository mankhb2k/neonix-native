import { describe, expect, it } from "vitest";
import {
  applyRippleAfter,
  resolveAudioPlacementIntent,
  resolveVisualPlacement,
} from "../operations/clip-move";
import {
  DEFAULT_VISUAL_POLICY,
  resolveLaneStartTimeNearest,
  resolveLayerStackPlacement,
  resolveExclusiveRowPlacement,
  resolveOccupancyAwarePlacement,
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

describe("resolveOccupancyAwarePlacement", () => {
  const blocker = [{ id: "b", startTime: 2, duration: 3 }];

  it("inserts above when start lands inside occupied span", () => {
    expect(
      resolveOccupancyAwarePlacement({
        clipsOnLane: blocker,
        desiredStart: 3,
        duration: 1,
        laneId: "ov-0",
        laneOrder: 0,
        laneRole: "overlay",
      }),
    ).toMatchObject({
      insertNewLane: true,
      insertOrder: 1,
    });
  });

  it("keeps free desired starts", () => {
    expect(
      resolveOccupancyAwarePlacement({
        clipsOnLane: blocker,
        desiredStart: 0,
        duration: 1,
        laneId: "ov-0",
        laneOrder: 0,
        laneRole: "overlay",
      }),
    ).toMatchObject({
      startTime: 0,
      insertNewLane: false,
    });
  });

  it("parks at head/tail when duration spills into a neighbor", () => {
    // desired 0.5 dur 2 overlaps [2,5); before=0 free → 0
    const result = resolveOccupancyAwarePlacement({
      clipsOnLane: blocker,
      desiredStart: 0.5,
      duration: 2,
      laneId: "base",
      laneOrder: -1,
      laneRole: "base",
    });
    expect(result.insertNewLane).toBe(false);
    expect(result.startTime).toBe(0);
  });

  it("retargets to free lane above instead of inserting", () => {
    const result = resolveOccupancyAwarePlacement({
      clipsOnLane: blocker,
      desiredStart: 3,
      duration: 1,
      laneId: "base",
      laneOrder: -1,
      laneRole: "base",
      siblingLanes: [
        { id: "base", order: -1, role: "base" },
        { id: "ov-0", order: 0, role: "overlay" },
      ],
      allClips: [
        { id: "b", laneId: "base", startTime: 2, duration: 3 },
        // ov-0 empty at t=3
      ],
    });
    expect(result).toMatchObject({
      insertNewLane: false,
      retargetLaneId: "ov-0",
      startTime: 3,
    });
  });

  it("retargets using clipsByLane map without scanning allClips", () => {
    const clipsByLane = new Map([
      ["base", blocker],
      ["ov-0", [] as typeof blocker],
    ]);
    const result = resolveOccupancyAwarePlacement({
      clipsOnLane: blocker,
      desiredStart: 3,
      duration: 1,
      laneId: "base",
      laneOrder: -1,
      laneRole: "base",
      siblingLanes: [
        { id: "base", order: -1, role: "base" },
        { id: "ov-0", order: 0, role: "overlay" },
      ],
      clipsByLane,
      overlayLaneRefs: [{ id: "ov-0", order: 0, role: "overlay" }],
    });
    expect(result).toMatchObject({
      insertNewLane: false,
      retargetLaneId: "ov-0",
      startTime: 3,
    });
  });

  it("inserts between when lane above is also occupied", () => {
    const result = resolveOccupancyAwarePlacement({
      clipsOnLane: blocker,
      desiredStart: 3,
      duration: 1,
      laneId: "base",
      laneOrder: -1,
      laneRole: "base",
      siblingLanes: [
        { id: "base", order: -1, role: "base" },
        { id: "ov-0", order: 0, role: "overlay" },
      ],
      allClips: [
        { id: "b", laneId: "base", startTime: 2, duration: 3 },
        { id: "up", laneId: "ov-0", startTime: 2.5, duration: 2 },
      ],
    });
    expect(result.insertNewLane).toBe(true);
    expect(result.insertOrder).toBe(0);
    expect(result.retargetLaneId ?? null).toBeNull();
  });
});

describe("resolveLayerStackPlacement", () => {
  const blocker = [{ id: "b", startTime: 0, duration: 10 }];

  it("keeps free desired starts on an empty row", () => {
    expect(
      resolveLayerStackPlacement({
        clipsOnLane: [],
        desiredStart: 2,
        duration: 1,
        laneOrder: 0,
        laneRole: "overlay",
      }),
    ).toMatchObject({ startTime: 2, insertNewLane: false });
  });

  it("always inserts a new row on overlap (never parks side-by-side)", () => {
    expect(
      resolveLayerStackPlacement({
        clipsOnLane: blocker,
        desiredStart: 0.5,
        duration: 2,
        laneOrder: 0,
        laneRole: "overlay",
      }),
    ).toMatchObject({
      startTime: 0.5,
      insertNewLane: true,
      insertOrder: 1,
    });
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

describe("resolveExclusiveRowPlacement", () => {
  const occupant = [{ id: "title", startTime: 4, duration: 2 }];

  it("places on an empty row", () => {
    expect(
      resolveExclusiveRowPlacement({
        clipsOnLane: [],
        desiredStart: 1.5,
      }),
    ).toMatchObject({
      startTime: 1.5,
      insertNewLane: false,
    });
    expect(
      resolveExclusiveRowPlacement({
        clipsOnLane: [],
        desiredStart: 1.5,
      }).swapClipId,
    ).toBeUndefined();
  });

  it("swaps with the occupant even when times do not overlap", () => {
    expect(
      resolveExclusiveRowPlacement({
        clipsOnLane: occupant,
        desiredStart: 0,
      }),
    ).toMatchObject({
      startTime: 0,
      insertNewLane: false,
      swapClipId: "title",
    });
  });

  it("ignores the moving clip via excludeIds", () => {
    expect(
      resolveExclusiveRowPlacement({
        clipsOnLane: occupant,
        desiredStart: 4,
        excludeIds: new Set(["title"]),
      }),
    ).toMatchObject({
      startTime: 4,
      insertNewLane: false,
    });
    expect(
      resolveExclusiveRowPlacement({
        clipsOnLane: occupant,
        desiredStart: 4,
        excludeIds: new Set(["title"]),
      }).swapClipId,
    ).toBeUndefined();
  });
});

describe("resolveAudioPlacementIntent", () => {
  const audioLanes: TimelineLane[] = [
    {
      id: "lane.audio.0",
      kind: "audio",
      role: "audio",
      order: -1,
      name: "BGM",
    },
    { id: "lane.audio.1", kind: "audio", role: "audio", order: -2, name: "VO" },
  ];
  const audioClips: TimelineClip[] = [
    {
      id: "a1",
      kind: "audio",
      audioTrackId: "audio.a",
      assetId: "asset.a",
      laneId: "lane.audio.0",
      startTime: 0,
      duration: 3,
      name: "A1",
    },
  ];

  it("create-lane for new-audio-lane intent", () => {
    expect(
      resolveAudioPlacementIntent(audioLanes, audioClips, {
        type: "new-audio-lane",
        insertOrder: 1,
        startTime: 0.5,
        duration: 2,
      }),
    ).toEqual({ status: "create-lane", insertOrder: 1, startTime: 0.5 });
  });

  it("missing-lane when laneId is not an audio lane", () => {
    expect(
      resolveAudioPlacementIntent(audioLanes, audioClips, {
        type: "audio-lane",
        laneId: "lane.main",
        startTime: 0,
        duration: 1,
      }),
    ).toEqual({ status: "blocked", reason: "missing-lane" });
  });

  it("locked audio lane is blocked", () => {
    const locked = audioLanes.map((l) =>
      l.id === "lane.audio.0" ? { ...l, locked: true } : l,
    );
    expect(
      resolveAudioPlacementIntent(locked, audioClips, {
        type: "audio-lane",
        laneId: "lane.audio.0",
        startTime: 1,
        duration: 1,
      }),
    ).toEqual({ status: "blocked", reason: "locked" });
  });

  it("nearest-snap on an occupied audio lane", () => {
    // a1 chiếm [0,3); desired 2.5 dur 2 → before=0 (dist 2.5), after=3 (dist 0.5) → 3
    expect(
      resolveAudioPlacementIntent(audioLanes, audioClips, {
        type: "audio-lane",
        laneId: "lane.audio.0",
        startTime: 2.5,
        duration: 2,
      }),
    ).toEqual({ status: "placed", laneId: "lane.audio.0", startTime: 3 });
  });

  it("free desired start keeps lane and time", () => {
    expect(
      resolveAudioPlacementIntent(audioLanes, audioClips, {
        type: "audio-lane",
        laneId: "lane.audio.1",
        startTime: 1,
        duration: 2,
      }),
    ).toEqual({ status: "placed", laneId: "lane.audio.1", startTime: 1 });
  });
});
