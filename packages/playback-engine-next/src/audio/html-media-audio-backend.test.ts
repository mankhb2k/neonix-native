import { describe, expect, it } from "vitest";
import { createHTMLMediaAudioBackendV3 } from "./html-media-audio-backend";

describe("HTML media audio fallback V3", () => {
  it("owns overlapping clips independently and releases inactive entries", () => {
    const created: Array<{ currentTime: number; volume: number; muted: boolean; plays: number; pauses: number; play(): void; pause(): void }> = [];
    const backend = createHTMLMediaAudioBackendV3({ resolveSource: () => true, createElement: () => { const element = { currentTime: 0, volume: 0, muted: true, plays: 0, pauses: 0, play() { this.plays += 1; }, pause() { this.pauses += 1; } }; created.push(element); return element; } });
    const plan = { sampleRate: 48000 as const, startSample: 48000, endSample: 50048, inputs: [{ trackId: "t", clipId: "a", source: { mediaId: "m", streamId: "a" }, sourceSampleRate: 48000, channels: 2, gainLinear: 0.5, pan: 0, muted: false, compositionStartSample: 0, compositionEndSample: 96000, segments: [{ compositionStartSample: 0, compositionEndSample: 96000, clipTimelineStartSample: 0, clipTimelineDurationSamples: 96000, sourceStartSample: 0, sourceEndSample: 96000, gainEnvelope: { baseGain: 1 } }] }] };
    backend.publish(plan, { generation: 0, operationId: 1, kind: "tick" });
    backend.start?.({ generation: 0, operationId: 2, kind: "play" });
    expect(created[0]).toMatchObject({ currentTime: 1, volume: 0.5, muted: false, plays: 1 });
    backend.publish({ ...plan, inputs: [] }, { generation: 0, operationId: 3, kind: "tick" });
    expect(created[0]?.pauses).toBe(1);
  });
  it("contains rejected native play promises", async () => {
    const failures: unknown[] = [];
    const backend = createHTMLMediaAudioBackendV3({
      resolveSource: () => true,
      createElement: () => ({ currentTime: 0, volume: 0, muted: false, play: () => Promise.reject(new DOMException("blocked", "NotAllowedError")), pause() {} }),
      onPlayFailure: (failure) => failures.push(failure),
    });
    const plan = { sampleRate: 48000 as const, startSample: 0, endSample: 2048, inputs: [{ trackId: "t", clipId: "a", source: { mediaId: "m", streamId: "a" }, sourceSampleRate: 48000, channels: 2, gainLinear: 1, pan: 0, muted: false, compositionStartSample: 0, compositionEndSample: 96000, segments: [{ compositionStartSample: 0, compositionEndSample: 96000, clipTimelineStartSample: 0, clipTimelineDurationSamples: 96000, sourceStartSample: 0, sourceEndSample: 96000, gainEnvelope: { baseGain: 1 } }] }] };
    backend.publish(plan, { generation: 0, operationId: 1, kind: "tick" });
    backend.start?.({ generation: 0, operationId: 2, kind: "play" });
    await Promise.resolve();
    await Promise.resolve();
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ backend: "audio" });
  });
});
