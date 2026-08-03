import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useVisibleTimeline } from "./use-visible-timeline";
import { TIMELINE_CLIP_OVERSCAN_PX } from "./visible-lane-window";

describe("useVisibleTimeline", () => {
  it("keeps clipsForLane identity stable when timeRange changes but clips are unchanged", () => {
    const clipsByLane = new Map([
      [
        "lane1",
        [
          { id: "c1", startTime: 0, duration: 10, name: "Clip 1" } as any,
        ],
      ],
    ]);

    const { result, rerender } = renderHook(
      (props: any) => useVisibleTimeline(props),
      {
        initialProps: {
          scrollLeft: 0,
          viewWidth: 1000,
          pixelsPerSecond: 10,
          clipsByLane,
        },
      }
    );

    // Initial evaluation
    const initialClips = result.current.clipsForLane("lane1");
    expect(initialClips).toHaveLength(1);

    // Rerender with a small scroll change that doesn't change visible clips
    rerender({
      scrollLeft: 100, // Move 10s right (100px / 10pps = 10s). Wait, clip is at 0-10, so end is 100. Overscan is 120, so still visible.
      viewWidth: 1000,
      pixelsPerSecond: 10,
      clipsByLane,
    });

    const nextClips = result.current.clipsForLane("lane1");
    
    // The reference must be identically equal (same array)
    expect(nextClips).toBe(initialClips);
  });

  it("returns a new array when a clip enters or leaves the visible window", () => {
    const clipsByLane = new Map([
      [
        "lane1",
        [
          { id: "c1", startTime: 1000, duration: 10, name: "Far Clip" } as any,
        ],
      ],
    ]);

    const { result, rerender } = renderHook(
      (props: any) => useVisibleTimeline(props),
      {
        initialProps: {
          scrollLeft: 0,
          viewWidth: 1000,
          pixelsPerSecond: 10,
          clipsByLane,
        },
      }
    );

    // Initially out of view (t=1000, overscan=120px=12s)
    const initialClips = result.current.clipsForLane("lane1");
    expect(initialClips).toHaveLength(0);

    // Scroll massive amount to bring clip into view
    rerender({
      scrollLeft: 10000, 
      viewWidth: 1000,
      pixelsPerSecond: 10,
      clipsByLane,
    });

    const nextClips = result.current.clipsForLane("lane1");
    expect(nextClips).toHaveLength(1);
    expect(nextClips).not.toBe(initialClips);
  });
});
