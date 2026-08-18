import { describe, expect, it } from "vitest";
import { frameIndexAtTime } from "@motionvideo/motion-runtime";
import { playbackFrameIndex, playbackFrameTime } from "../playback/time-frame";

/**
 * Parity test: `playbackFrameIndex` / `playbackFrameTime` phải khớp
 * `frameIndexAtTime` của runtime cho input hợp lệ, và fallback an toàn
 * (không throw) cho input biên: NaN, Infinity, fps <= 0, time < 0.
 */
describe("playbackFrameIndex parity", () => {
  it("matches runtime frameIndexAtTime for valid inputs", () => {
    const samples = [0, 0.5, 0.999, 1.0, 1.01, 1.034, 2.0, 10.25];
    for (const time of samples) {
      expect(playbackFrameIndex(time, 30)).toBe(frameIndexAtTime(time, 30));
    }
  });

  it("exact-frame boundary at 30fps: 1.0s → frame 30", () => {
    expect(playbackFrameIndex(1.0, 30)).toBe(30);
    // 1.033...s mới sang frame 31 (floor + FRAME_EPSILON).
    expect(playbackFrameIndex(1.0333333333, 30)).toBe(30);
    expect(playbackFrameIndex(1.034, 30)).toBe(31);
  });

  it("frame 30/31 transition is monotonic and exact", () => {
    expect(playbackFrameIndex(30 / 30, 30)).toBe(30);
    expect(playbackFrameIndex(31 / 30, 30)).toBe(31);
  });

  it("NaN time falls back to frame 0 (no throw)", () => {
    expect(playbackFrameIndex(Number.NaN, 30)).toBe(0);
    expect(playbackFrameIndex(Number.POSITIVE_INFINITY, 30)).toBe(0);
    expect(playbackFrameIndex(Number.NEGATIVE_INFINITY, 30)).toBe(0);
  });

  it("negative time clamps to frame 0 (no throw)", () => {
    expect(playbackFrameIndex(-5, 30)).toBe(0);
    expect(playbackFrameIndex(-0.001, 30)).toBe(0);
  });

  it("fps <= 0 is treated as 1 (no throw)", () => {
    expect(playbackFrameIndex(2.0, 0)).toBe(2);
    expect(playbackFrameIndex(2.0, -30)).toBe(2);
    expect(playbackFrameIndex(2.0, Number.NaN)).toBe(2);
  });

  it("playbackFrameTime quantizes to the start of the display frame", () => {
    expect(playbackFrameTime(1.0, 30)).toBe(1.0);
    expect(playbackFrameTime(1.034, 30)).toBe(31 / 30);
    expect(playbackFrameTime(Number.NaN, 30)).toBe(0);
    expect(playbackFrameTime(2.0, 0)).toBe(2);
  });
});
