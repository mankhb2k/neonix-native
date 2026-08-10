import { beforeEach, describe, expect, it } from "vitest";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@motionvideo/editor-core";

describe("playback clock store", () => {
  beforeEach(() => {
    usePlaybackClock.setState({
      currentTime: 0,
      duration: 0,
      mode: "idle",
      playbackRate: 1,
    });
  });

  it("clamps seek to duration", () => {
    usePlaybackClock.getState().setDuration(5);
    usePlaybackClock.getState().seek(9);
    expect(usePlaybackClock.getState().currentTime).toBe(5);
  });

  it("restarts from 0 when play is pressed at the end", () => {
    usePlaybackClock.getState().setDuration(4);
    usePlaybackClock.getState().seek(4);
    usePlaybackClock.getState().play();
    expect(usePlaybackClock.getState().currentTime).toBe(0);
    expect(usePlaybackClock.getState().mode).toBe("playing");
  });

  it("reset atomically sets duration, time and idle mode", () => {
    usePlaybackClock.getState().setDuration(10);
    usePlaybackClock.getState().seek(5);
    usePlaybackClock.getState().play();
    usePlaybackClock.getState().reset({ duration: 8, currentTime: 0 });
    expect(usePlaybackClock.getState()).toMatchObject({
      duration: 8,
      currentTime: 0,
      mode: "idle",
      playbackRate: 1,
    });
  });

  it("beginScrub then endScrub returns to idle", () => {
    usePlaybackClock.getState().setDuration(10);
    usePlaybackClock.getState().beginScrub();
    expect(usePlaybackClock.getState().mode).toBe("scrubbing");
    usePlaybackClock.getState().endScrub();
    expect(usePlaybackClock.getState().mode).toBe("idle");
  });

  it("frame index is stable for display consumers", () => {
    expect(playbackFrameIndex(1.0, 30)).toBe(30);
    expect(playbackFrameIndex(1.01, 30)).toBe(30);
    // 1.033...s mới sang frame 31 ở 30fps (floor).
    expect(playbackFrameIndex(1.034, 30)).toBe(31);
  });
});
