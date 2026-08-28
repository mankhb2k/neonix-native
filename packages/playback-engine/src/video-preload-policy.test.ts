import { describe, expect, it } from "vitest";
import { decideVideoPreload } from "./video-preload-policy";

describe("video preload policy", () => {
  it("warms active or lookahead assets only during playback", () => {
    expect(decideVideoPreload({ active: true, lookahead: false, playing: true })).toEqual({ preload: "auto", shouldPause: false });
    expect(decideVideoPreload({ active: false, lookahead: true, playing: true })).toEqual({ preload: "auto", shouldPause: false });
    expect(decideVideoPreload({ active: true, lookahead: false, playing: false })).toEqual({ preload: "auto", shouldPause: true });
  });

  it("reduces preload and pauses under hidden or memory pressure", () => {
    expect(decideVideoPreload({ active: true, lookahead: false, playing: true, hidden: true })).toEqual({ preload: "metadata", shouldPause: true });
    expect(decideVideoPreload({ active: true, lookahead: false, playing: true, memoryPressure: true })).toEqual({ preload: "metadata", shouldPause: false });
  });
});
