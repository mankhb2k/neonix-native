import { describe, expect, it } from "vitest";
import type { RuntimeAudioMixPlanV3 } from "@motionvideo/motion-runtime";
import {
  createWebAudioGraphBackendV3,
  type WebAudioContextV3,
  type WebAudioParamV3,
} from "./web-audio-graph-backend";

function audioPlan(muted: boolean): RuntimeAudioMixPlanV3 {
  return {
    sampleRate: 48_000,
    startSample: 48_000,
    endSample: 50_048,
    inputs: [{
      trackId: "video-audio",
      clipId: "embedded-audio:video-01:clip",
      source: { mediaId: "video-01", streamId: "video-01:audio" },
      sourceSampleRate: 48_000,
      channels: 2,
      gainLinear: 0.5,
      pan: 0,
      muted,
      compositionStartSample: 0,
      compositionEndSample: 96_000,
      segments: [{
        compositionStartSample: 0,
        compositionEndSample: 96_000,
        clipTimelineStartSample: 0,
        clipTimelineDurationSamples: 96_000,
        sourceStartSample: 0,
        sourceEndSample: 96_000,
        gainEnvelope: { baseGain: 1 },
      }],
    }],
  };
}

describe("Web Audio mute semantics", () => {
  it("keeps an active source playing while a muted mix input becomes silent", async () => {
    const gainCalls: string[] = [];
    const gainParam: WebAudioParamV3 = {
      value: 1,
      cancelScheduledValues: () => gainCalls.push("cancel"),
      setValueAtTime: (value) => gainCalls.push(`set:${value}`),
      linearRampToValueAtTime: (value) => gainCalls.push(`ramp:${value}`),
    };
    const node = { connect: () => undefined, disconnect: () => undefined };
    const context: WebAudioContextV3 = {
      currentTime: 0,
      destination: {},
      createMediaElementSource: () => node,
      createGain: () => ({ ...node, gain: gainParam }),
      createStereoPanner: () => ({ ...node, pan: gainParam }),
    };
    let pauses = 0;
    let plays = 0;
    const backend = createWebAudioGraphBackendV3({
      context,
      resolveSource: () => true,
      createElement: () => ({
        currentTime: 0,
        volume: 1,
        muted: false,
        paused: true,
        play() { plays += 1; },
        pause() { pauses += 1; },
      } as unknown as HTMLAudioElement),
    });

    backend.publish(audioPlan(false), { generation: 0, operationId: 1, kind: "seek" });
    await backend.start?.({ generation: 0, operationId: 2, kind: "play" });
    backend.publish(audioPlan(true), { generation: 0, operationId: 3, kind: "tick" });

    expect(plays).toBeGreaterThan(0);
    expect(pauses).toBe(0);
    expect(gainCalls).toContain("set:0");
  });
});
