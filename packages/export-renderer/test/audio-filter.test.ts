import { describe, expect, it } from "vitest";
import { resolveAudioWindow, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { resolveFfmpegAudioMix } from "../src/render/audio-filter";

const project = {
  format: "motion-runtime",
  runtimeVersion: 3,
  projectId: "audio-filter-test",
  durationUs: 1_000_000,
  visual: { composition: { width: 2, height: 2, fps: 30, background: "#000000" }, view: {}, nodes: [] },
  mediaCatalog: {
    assets: [{
      mediaId: "music",
      audio: [{
        streamId: "music:audio",
        resource: { resourceId: "music:audio:original", role: "original", uri: "/api/docs/audio" },
        durationSamples: 480_000,
        sampleRate: 48_000,
        channels: 2,
      }],
    }],
  },
  videoTimeline: { instances: [] },
  audioTimeline: {
    sampleRate: 48_000,
    tracks: [{
      trackId: "track",
      gainLinear: 1,
      pan: 1,
      muted: false,
      clips: [{
        clipId: "clip",
        trackId: "track",
        source: { mediaId: "music", streamId: "music:audio" },
        timelineStartSample: 0,
        timelineDurationSamples: 48_000,
        sourceStartSample: 0,
        playbackRate: 1,
        gainLinear: 0.5,
        pan: 0,
        muted: false,
      }],
    }],
  },
} as RuntimeProjectV3;

describe("resolveFfmpegAudioMix", () => {
  it("turns Runtime audio inputs into delayed, panned FFmpeg inputs", () => {
    const plan = resolveAudioWindow(project, { startSample: 0, frameCount: 48_000 });
    const resolved = resolveFfmpegAudioMix(project, plan, "D:/repo/apps/web/public");
    expect(resolved?.inputs).toHaveLength(1);
    expect(resolved?.inputs[0]?.path).toBe("D:\\repo\\apps\\web\\public\\preview\\audio\\Music-MBB-Island-Tropical_128k.mp3");
    expect(resolved?.filterComplex).toContain("[1:a]");
    expect(resolved?.filterComplex).toContain("volume=0.5");
    expect(resolved?.filterComplex).toContain("pan=stereo|c0=0*c0|c1=1*c1");
    expect(resolved?.filterComplex).toContain("[aout]");
  });
});
