import { describe, expect, it } from "vitest";
import {
  atempoChain,
  buildFfmpegAudioMixFilters,
} from "./index";
import type { AudioRenderPlan } from "@motionvideo/motion-runtime";

describe("atempoChain", () => {
  it("returns empty for rate ≈ 1", () => {
    expect(atempoChain(1)).toEqual([]);
  });

  it("emits a single atempo within 0.5..2", () => {
    expect(atempoChain(1.25)).toEqual(["atempo=1.25"]);
  });

  it("chains when rate > 2", () => {
    expect(atempoChain(4)).toEqual(["atempo=2", "atempo=2"]);
  });
});

describe("buildFfmpegAudioMixFilters", () => {
  it("builds filters from AudioRenderPlan SoT (duration, rate, muted)", () => {
    const plan: AudioRenderPlan = {
      fps: 30,
      clips: [
        {
          trackId: "aud.bgm",
          assetId: "asset.bgm",
          uri: "assets/bgm.mp3",
          fromFrame: 30,
          durationInFrames: 90, // 3s @ 30fps — SoT
          trimStartSeconds: 0.5,
          trimEndSeconds: 20,
          assetDurationSeconds: 30,
          playbackRate: 1,
          volumeEnvelope: [
            { frame: 30, value: 0.8 },
            { frame: 120, value: 0.8 },
          ],
          role: "bgm",
          loop: false,
          muted: false,
          channelPolicy: "stereo",
        },
      ],
    };

    const { filters, hasAudio } = buildFfmpegAudioMixFilters(plan);
    expect(hasAudio).toBe(true);
    expect(filters[0]).toContain("atrim=start=0.5");
    // play window 3s, not (composition - start)
    expect(filters[0]).toContain("atrim=start=0:end=3");
    expect(filters[0]).toContain("adelay=1000:all=1");
    expect(filters[0]).toContain("volume=0.8");
    expect(filters.at(-1)).toContain("amix=inputs=1");
  });

  it("forces volume=0 when muted", () => {
    const plan: AudioRenderPlan = {
      fps: 30,
      clips: [
        {
          trackId: "aud.muted",
          assetId: "asset.sfx",
          uri: "assets/sfx.mp3",
          fromFrame: 0,
          durationInFrames: 30,
          trimStartSeconds: 0,
          trimEndSeconds: 5,
          assetDurationSeconds: 5,
          playbackRate: 1,
          volumeEnvelope: [
            { frame: 0, value: 0 },
            { frame: 30, value: 0 },
          ],
          role: "sfx",
          loop: false,
          muted: true,
          channelPolicy: "stereo",
        },
      ],
    };
    const { filters } = buildFfmpegAudioMixFilters(plan);
    expect(filters[0]).toContain("volume=0");
  });
});
