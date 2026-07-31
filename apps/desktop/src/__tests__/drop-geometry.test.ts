import { describe, expect, it } from "vitest";
import { resolveTimelineDropGeometry } from "../../renderer/src/editor/timeline/drop-geometry";

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

    const lanes = [
      {
        id: "base",
        kind: "visual" as const,
        role: "base" as const,
        name: "Main",
        order: -1,
        policy: { allowOverlap: false, rippleMode: true },
      },
      {
        id: "ov",
        kind: "visual" as const,
        role: "overlay" as const,
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
