import type { TimelineLane } from "@motionvideo/editor-core";
import { describe, expect, it } from "vitest";
import { resolveTimelineDropGeometry } from "./drop-geometry";

describe("resolveTimelineDropGeometry", () => {
  it("maps y to lane and x to startTime", () => {
    const scrollEl = {
      getBoundingClientRect: () => ({
        top: 100,
        left: 50,
        right: 850,
        bottom: 400,
        width: 800,
        height: 300,
      }),
      scrollTop: 0,
      scrollLeft: 0,
    } as unknown as HTMLElement;

    const lanes: TimelineLane[] = [
      {
        id: "lane.main",
        kind: "visual",
        role: "base",
        name: "Main",
        order: -1,
        policy: { allowOverlap: false, rippleMode: false },
      },
      {
        id: "ov",
        kind: "visual",
        role: "overlay",
        name: "Overlay",
        order: 0,
        policy: { allowOverlap: false, rippleMode: false },
      },
    ];

    const hit = resolveTimelineDropGeometry({
      clientX: 50 + 100 + 200,
      clientY: 100 + 10 + 40,
      scrollEl,
      lanes,
      lanesTop: 10,
      laneHeight: 40,
      pixelsPerSecond: 100,
      tracksOriginX: 100,
    });

    expect(hit).toEqual({
      laneId: "ov",
      startTime: 2,
      track: "overlay",
    });
  });
});
