import { describe, expect, it } from "vitest";
import { PcmWindowStoreV3 } from "./pcm-window";
import { createStreamingWorkletBackendV3 } from "./streaming-worklet-backend";
import { mixAudioPlanV3 } from "./audio-engine";

const source = { mediaId: "m", streamId: "a" } as const;
const chunk = (generation: number, startSample: number, value = 0.25) => ({ sourceRef: source, generation, startSample, sampleRate: 48000, channels: 1, frames: 4, data: new Float32Array([value, value, value, value]) });

describe("streaming audio primitives V3", () => {
  it("rejects stale generations and overlapping PCM while enforcing bounds", () => {
    const store = new PcmWindowStoreV3({ maxChunks: 1 });
    store.reset(2);
    expect(store.push(chunk(1, 0))).toBe(false);
    expect(store.push(chunk(2, 0))).toBe(true);
    expect(store.push(chunk(2, 2))).toBe(false);
    expect(store.stats()).toMatchObject({ chunks: 1, generation: 2 });
  });

  it("posts reset/start and transfers only current-generation PCM", () => {
    const messages: unknown[] = [];
    const backend = createStreamingWorkletBackendV3({ port: { postMessage(message) { messages.push(message); } } });
    const token = { generation: 4, operationId: 1, kind: "play" as const };
    backend.reset(token, 100);
    expect(backend.push("input", chunk(4, 100), [], token)).toBe(true);
    expect(backend.push("input", chunk(3, 0), [], token)).toBe(false);
    backend.start(token);
    expect(messages.map((message) => (message as { type: string }).type)).toEqual(["reset", "push-pcm", "start"]);
  });

  it("uses the same clip-global fade and pan semantics as the offline mixer", () => {
    const plan = {
      sampleRate: 48000 as const,
      startSample: 4,
      endSample: 8,
      inputs: [{
        trackId: "music",
        clipId: "music-01",
        source,
        sourceSampleRate: 48000,
        channels: 1,
        gainLinear: 1,
        pan: 1,
        muted: false,
        compositionStartSample: 4,
        compositionEndSample: 8,
        segments: [{
          compositionStartSample: 4,
          compositionEndSample: 8,
          clipTimelineStartSample: 0,
          clipTimelineDurationSamples: 8,
          sourceStartSample: 4,
          sourceEndSample: 8,
          gainEnvelope: { baseGain: 1, fadeIn: { curve: "linear" as const, start: 0, end: 0.5 } },
        }],
      }],
    };
    const sources = new Map([["m:a", [chunk(0, 4, 1)]]]);

    expect(Array.from(mixAudioPlanV3(plan, sources))).toEqual([
      0, 1,
      0, 1,
      0, 1,
      0, 1,
    ]);
  });
});
