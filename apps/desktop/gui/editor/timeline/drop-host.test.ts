import { describe, expect, it } from "vitest";
import { resolveTimelineDropGeometry } from "./drop-geometry";
import {
  getTimelineDropHost,
  setTimelineDropHost,
} from "./drop-host";

describe("drop-host registry", () => {
  it("stores and clears the active timeline host", () => {
    setTimelineDropHost(null);
    expect(getTimelineDropHost()).toBeNull();

    const scrollEl = {
      getBoundingClientRect: () => ({
        top: 0,
        left: 0,
        right: 400,
        bottom: 200,
        width: 400,
        height: 200,
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
        policy: { allowOverlap: false as const, rippleMode: true },
      },
    ];

    setTimelineDropHost({
      scrollEl,
      lanes,
      lanesTop: 0,
      laneHeight: 40,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
    });

    const host = getTimelineDropHost();
    expect(host?.lanes[0]?.id).toBe("base");

    const geo = resolveTimelineDropGeometry({
      clientX: 150,
      clientY: 10,
      scrollEl,
      lanes,
      lanesTop: 0,
      laneHeight: 40,
      pixelsPerSecond: 100,
      tracksOriginX: 0,
    });
    expect(geo).toEqual({
      laneId: "base",
      startTime: 1.5,
      track: "main",
    });

    setTimelineDropHost(null);
    expect(getTimelineDropHost()).toBeNull();
  });
});
