import { describe, expect, it } from "vitest";
import { getVideoTimelineDurationLimit } from "../../../src/timeline/policies/video-duration";

describe("getVideoTimelineDurationLimit", () => {
  it("caps a clip to the selected source range", () => {
    expect(getVideoTimelineDurationLimit({ sourceDuration: 260 })).toBe(260);
    expect(getVideoTimelineDurationLimit({ sourceDuration: 260, trimStart: 10, trimEnd: 80 })).toBe(70);
  });

  it("accounts for playback rate and rejects invalid ranges", () => {
    expect(getVideoTimelineDurationLimit({ sourceDuration: 60, trimStart: 10, playbackRate: 2 })).toBe(25);
    expect(getVideoTimelineDurationLimit({ sourceDuration: 60, trimStart: 70 })).toBeUndefined();
    expect(getVideoTimelineDurationLimit({ sourceDuration: 60, playbackRate: 0 })).toBeUndefined();
  });
});
