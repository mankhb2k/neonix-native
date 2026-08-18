import { describe, it, expect } from "vitest";
import { audioAnalysisToTimelineClips } from "../mapping/audio-to-clips";
import { analyzePcm } from "../analyze";
import { silence, pulseTrain } from "./helpers";

const SR = 44100;

function pulseAnalysis() {
  return analyzePcm({
    samples: pulseTrain(SR, 2, 1, 60),
    sampleRate: SR,
    projectId: "proj_123",
    audioAssetId: "asset.audio.main",
  });
}

describe("audioAnalysisToTimelineClips", () => {
  it("produces clips for neon-circle-pulse", () => {
    const clips = audioAnalysisToTimelineClips({
      analysis: pulseAnalysis(),
      preset: "neon-circle-pulse",
      targets: { ringLayerId: "visualizer.ring", glowEffectId: "fx-glow-1" },
    });
    expect(clips.length).toBeGreaterThan(0);
    for (const clip of clips) {
      expect(clip.id).toBeTruthy();
      expect(clip.layerId).toBeTruthy();
      expect(clip.property).toBeTruthy();
      expect(clip.keys.length).toBeGreaterThan(0);
    }
  });

  it("emits sorted, unique keyframe times", () => {
    const clips = audioAnalysisToTimelineClips({
      analysis: pulseAnalysis(),
      preset: "neon-circle-pulse",
      targets: { ringLayerId: "visualizer.ring", glowEffectId: "fx-glow-1" },
    });
    for (const clip of clips) {
      for (let i = 1; i < clip.keys.length; i++) {
        expect(clip.keys[i].t).toBeGreaterThan(clip.keys[i - 1].t);
      }
    }
  });

  it("emits beat glow spikes around each beat", () => {
    const clips = audioAnalysisToTimelineClips({
      analysis: pulseAnalysis(),
      preset: "neon-circle-pulse",
      targets: { ringLayerId: "visualizer.ring", glowEffectId: "fx-glow-1" },
    });
    const glow = clips.find((c) => c.id === "clip-beat-glow");
    expect(glow).toBeDefined();
    expect(glow!.property).toBe("effects.fx-glow-1.opacity");
    expect(glow!.keys.length).toBeGreaterThan(0);
  });

  it("emits a single merged transform.scale clip", () => {
    const clips = audioAnalysisToTimelineClips({
      analysis: pulseAnalysis(),
      preset: "neon-circle-pulse",
      targets: { ringLayerId: "visualizer.ring", glowEffectId: "fx-glow-1" },
    });
    const scaleClips = clips.filter((c) => c.property === "transform.scale");
    expect(scaleClips).toHaveLength(1);
    expect(scaleClips[0].id).toBe("clip-ring-scale");
  });

  it("skips opacity/brightness clips without a glow target", () => {
    const clips = audioAnalysisToTimelineClips({
      analysis: pulseAnalysis(),
      preset: "neon-circle-pulse",
      targets: { ringLayerId: "visualizer.ring" },
    });
    const glowClips = clips.filter((c) => c.property.endsWith(".opacity"));
    expect(glowClips).toHaveLength(0);
  });

  it("caps keyframe count via maxKeysPerClip", () => {
    const clips = audioAnalysisToTimelineClips({
      analysis: pulseAnalysis(),
      preset: "neon-circle-pulse",
      targets: { ringLayerId: "visualizer.ring", glowEffectId: "fx-glow-1" },
      options: { maxKeysPerClip: 5 },
    });
    for (const clip of clips) {
      expect(clip.keys.length).toBeLessThanOrEqual(5);
    }
  });

  it("emits no beat clips for silent audio", () => {
    const analysis = analyzePcm({
      samples: silence(SR, 1),
      sampleRate: SR,
      projectId: "proj_123",
      audioAssetId: "asset.audio.main",
    });
    const clips = audioAnalysisToTimelineClips({
      analysis,
      preset: "neon-circle-pulse",
      targets: { ringLayerId: "visualizer.ring", glowEffectId: "fx-glow-1" },
    });
    const beatClips = clips.filter((c) => c.id.startsWith("clip-beat"));
    expect(beatClips).toHaveLength(0);
  });
});
