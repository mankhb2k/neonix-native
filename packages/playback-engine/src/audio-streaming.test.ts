import { describe, expect, it } from "vitest";
import { createAudioStreamingSessionV2 } from "./audio-streaming";
import { createRollingPcmBufferV2 } from "./rolling-pcm-buffer";

describe("AudioStreamingSessionV2", () => {
  it("deduplicates in-flight decode and publishes decoded chunks", async () => {
    let calls = 0;
    const decoder = {
      async decode(_source: never, range: { generation: number }) {
        calls += 1;
        return [{
          startSample: 0,
          sampleRate: 48000,
          channels: 2,
          data: new Float32Array(480),
          generation: range.generation,
        }];
      },
    };
    const session = createAudioStreamingSessionV2(
      { assetId: "a", kind: "audio", uri: "/a" },
      decoder,
      createRollingPcmBufferV2({ maxBytes: 4096 }),
    );
    session.reset(1);
    const range = { startSample: 0, endSample: 240, generation: 1 };
    const [first, second] = await Promise.all([session.ensure(range), session.ensure(range)]);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(calls).toBe(1);
    expect(session.buffer.getStats().chunks).toBe(1);
    session.close();
  });

  it("drops decode completion after seek reset", async () => {
    let resolveDecode!: (value: readonly never[]) => void;
    const decoder = { decode: () => new Promise<readonly never[]>((resolve) => { resolveDecode = resolve; }) };
    const session = createAudioStreamingSessionV2(
      { assetId: "a", kind: "audio", uri: "/a" }, decoder, createRollingPcmBufferV2(),
    );
    const pending = session.ensure({ startSample: 0, endSample: 10, generation: 0 });
    session.reset(1);
    resolveDecode([]);
    expect(await pending).toBe(false);
    expect(session.buffer.getStats().chunks).toBe(0);
    session.close();
  });
});
