import { describe, expect, it } from "vitest";
import {
  audioDropPolicy,
  resolveAudioDragTarget,
  resolveLaneDropTarget,
  resolveOverlayDragTarget,
  visualDropPolicy,
  type AudioLaneHit,
  type LaneHit,
  type VideoLaneHit,
} from "@/components/desktop/editor/timeline/Tracks/lane-drop-target";

const lanes: VideoLaneHit[] = [
  { top: 100, bottom: 140, type: "overlay", laneId: "ov1", order: 1 },
  { top: 140, bottom: 180, type: "main", laneId: "main", order: null },
];

const visualHits: LaneHit[] = [
  {
    top: 100,
    bottom: 140,
    family: "visual",
    role: "overlay",
    laneId: "ov1",
    order: 1,
  },
  {
    top: 140,
    bottom: 180,
    family: "visual",
    role: "base",
    laneId: "main",
    order: null,
  },
];

describe("resolveOverlayDragTarget", () => {
  it("body hit returns overlay laneId without insert", () => {
    const target = resolveOverlayDragTarget(120, lanes, 100, false, 1);
    expect(target).toEqual({
      isInsert: false,
      laneId: "ov1",
      insertOrder: null,
      indicatorTop: 0,
    });
  });

  it("gap between lanes is insert", () => {
    const withGap: VideoLaneHit[] = [
      { top: 100, bottom: 130, type: "overlay", laneId: "ov1", order: 1 },
      { top: 150, bottom: 190, type: "main", laneId: "main", order: null },
    ];
    const target = resolveOverlayDragTarget(140, withGap, 100, false, 1);
    expect(target?.isInsert).toBe(true);
    expect(target?.laneId).toBeNull();
    expect(target?.insertOrder).toBe(1);
  });

  it("main body is not insert", () => {
    const target = resolveOverlayDragTarget(160, lanes, 100, false, 1);
    expect(target?.isInsert).toBe(false);
    expect(target?.laneId).toBeNull();
  });

  it("virtual overlay placeholder body maps to insert", () => {
    const withPlaceholder: VideoLaneHit[] = [
      { top: 100, bottom: 140, type: "overlay", laneId: null, order: 0 },
      { top: 140, bottom: 180, type: "main", laneId: "main", order: null },
    ];
    const target = resolveOverlayDragTarget(120, withPlaceholder, 100, false, 0);
    expect(target?.isInsert).toBe(true);
    expect(target?.insertOrder).toBe(0);
  });
});

describe("resolveLaneDropTarget", () => {
  it("visual body matches legacy overlay resolver", () => {
    const unified = resolveLaneDropTarget(
      120,
      visualHits,
      100,
      false,
      1,
      visualDropPolicy,
    );
    const legacy = resolveOverlayDragTarget(120, lanes, 100, false, 1);
    expect(unified?.isInsert).toBe(legacy?.isInsert);
    expect(unified?.laneId).toBe(legacy?.laneId);
    expect(unified?.insertOrder).toBe(legacy?.insertOrder);
    expect(unified?.family).toBe("visual");
  });

  it("visual hysteresis keeps insert near top edge after insert mode", () => {
    // Overlay 100–140; ENTER=2, EXIT=10. clientY=105 → relY=5 (still insert while wasInsert).
    const nearTop = resolveLaneDropTarget(
      105,
      visualHits,
      100,
      true,
      1,
      visualDropPolicy,
    );
    expect(nearTop?.isInsert).toBe(true);
    expect(nearTop?.family).toBe("visual");
  });

  it("visual hysteresis exits insert once deep in body", () => {
    // relY=15 > EXIT=10 → body while wasInsert.
    const deepBody = resolveLaneDropTarget(
      115,
      visualHits,
      100,
      true,
      1,
      visualDropPolicy,
    );
    expect(deepBody).toEqual({
      family: "visual",
      isInsert: false,
      laneId: "ov1",
      insertOrder: null,
      indicatorTop: 0,
    });
  });

  it("visual base body sets overBaseBody", () => {
    const onBase = resolveLaneDropTarget(
      160,
      visualHits,
      100,
      false,
      1,
      visualDropPolicy,
    );
    expect(onBase).toMatchObject({
      family: "visual",
      isInsert: false,
      laneId: null,
      overBaseBody: true,
    });
  });

  it("audio hysteresis keeps insert near edge after insert mode", () => {
    const audioHits: LaneHit[] = [
      {
        top: 100,
        bottom: 140,
        family: "audio",
        role: "base",
        laneId: "main",
        order: null,
      },
      {
        top: 140,
        bottom: 180,
        family: "audio",
        role: "audio",
        laneId: "au0",
        order: 0,
      },
    ];
    const nearTop = resolveLaneDropTarget(
      141,
      audioHits,
      100,
      true,
      0,
      audioDropPolicy,
    );
    expect(nearTop?.isInsert).toBe(true);
    expect(nearTop?.family).toBe("audio");
  });
});

describe("resolveAudioDragTarget", () => {
  const audioLanes: AudioLaneHit[] = [
    { top: 100, bottom: 140, type: "main", laneId: "main", order: null },
    { top: 140, bottom: 180, type: "audio", laneId: "au0", order: 0 },
  ];

  it("audio body hit returns laneId", () => {
    const target = resolveAudioDragTarget(160, audioLanes, 100, false, 0);
    expect(target?.isInsert).toBe(false);
    expect(target?.laneId).toBe("au0");
  });

  it("hysteresis keeps insert when near edge after insert mode", () => {
    const nearTop = resolveAudioDragTarget(141, audioLanes, 100, true, 0);
    expect(nearTop?.isInsert).toBe(true);
  });
});
