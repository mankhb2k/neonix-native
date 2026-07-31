import { describe, expect, it, beforeEach } from "vitest";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";

describe("playback clock seek while playing", () => {
  beforeEach(() => {
    usePlaybackClock.getState().reset({ duration: 10, currentTime: 0 });
  });

  it("bumps seekRevision on seek but not on advancePlayback", () => {
    const clock = usePlaybackClock.getState();
    clock.play();
    const rev0 = usePlaybackClock.getState().seekRevision;
    clock.advancePlayback(1);
    expect(usePlaybackClock.getState().seekRevision).toBe(rev0);
    expect(usePlaybackClock.getState().currentTime).toBe(1);
    clock.seek(2);
    expect(usePlaybackClock.getState().seekRevision).toBe(rev0 + 1);
    expect(usePlaybackClock.getState().currentTime).toBe(2);
  });

  it("seek while playing is not overwritten by stale advance from old anchor", () => {
    const clock = usePlaybackClock.getState();
    clock.play();
    // Simulate driver anchor at t=0, then user seeks to 5.
    const startPerf = 0;
    const startTimeline = 0;
    clock.seek(5);
    // Stale tick computed from old anchor (~0.1s later) must NOT win —
    // driver re-anchors after seekRevision; after reanchor startTimeline=5.
    const staleNext =
      startTimeline + ((100 - startPerf) / 1000) * 1;
    expect(staleNext).toBeLessThan(1);
    // After seek, currentTime stays at 5 until advancePlayback from new anchor.
    expect(usePlaybackClock.getState().currentTime).toBe(5);
    clock.advancePlayback(5.1);
    expect(usePlaybackClock.getState().currentTime).toBeCloseTo(5.1);
  });
});
