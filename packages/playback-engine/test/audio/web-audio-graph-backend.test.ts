import { describe, expect, it } from "vitest";
import { createWebAudioGraphBackendV3, type WebAudioContextV3, type WebAudioParamV3 } from "../../src/audio/web-audio-graph-backend";

function param(value = 0): WebAudioParamV3 & { calls: string[] } {
  const calls: string[] = [];
  return {
    value,
    calls,
    cancelScheduledValues: () => calls.push("cancel"),
    setValueAtTime: (next) => { calls.push(`set:${next}`); },
    linearRampToValueAtTime: (next) => { calls.push(`ramp:${next}`); },
  };
}

describe("Web Audio graph backend V3", () => {
  it("routes every active clip through gain, pan and one master output", () => {
    const gainParams: ReturnType<typeof param>[] = [];
    const panParams: ReturnType<typeof param>[] = [];
    const connections: unknown[] = [];
    const node = { connect(destination: unknown) { connections.push(destination); return destination; } };
    const context: WebAudioContextV3 = {
      currentTime: 10,
      destination: {},
      createMediaElementSource: () => node,
      createGain: () => { const gain = param(); gainParams.push(gain); return { ...node, gain }; },
      createStereoPanner: () => { const pan = param(); panParams.push(pan); return { ...node, pan }; },
    };
    let plays = 0;
    const backend = createWebAudioGraphBackendV3({
      context,
      resolveSource: () => true,
      createElement: () => ({ currentTime: 0, volume: 0, muted: true, play() { plays += 1; }, pause() {} } as unknown as HTMLAudioElement),
    });
    const plan = {
      sampleRate: 48_000 as const,
      startSample: 48_000,
      endSample: 50_048,
      inputs: [{
        trackId: "music",
        clipId: "bed",
        source: { mediaId: "music", streamId: "audio" },
        sourceSampleRate: 48_000,
        channels: 2,
        gainLinear: 0.5,
        pan: 0.25,
        muted: false,
        compositionStartSample: 0,
        compositionEndSample: 96_000,
        segments: [{ compositionStartSample: 0, compositionEndSample: 96_000, clipTimelineStartSample: 0, clipTimelineDurationSamples: 96_000, sourceStartSample: 0, sourceEndSample: 96_000, gainEnvelope: { baseGain: 1 } }],
      }],
    };
    backend.publish(plan, { generation: 1, operationId: 1, kind: "seek" });
    backend.start?.({ generation: 1, operationId: 2, kind: "play" });

    expect(connections).toHaveLength(4);
    expect(gainParams[1]?.calls).toContain("set:0.5");
    expect(panParams[0]?.calls).toContain("set:0.25");
    expect(plays).toBe(1);
  });
});
