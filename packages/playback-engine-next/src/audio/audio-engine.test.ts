import { describe, expect, it } from "vitest";
import { PcmWindowStoreV3 } from "./pcm-window";
import { createStreamingWorkletBackendV3 } from "./streaming-worklet-backend";

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
});
