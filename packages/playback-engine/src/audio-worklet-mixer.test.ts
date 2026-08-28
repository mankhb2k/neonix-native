import { describe, expect, it } from "vitest";
import { createAudioWorkletMixerV2 } from "./audio-worklet-mixer";

function fakeMixerContext() {
  const messages: unknown[] = [];
  const node = {
    port: { postMessage(message: unknown) { messages.push(message); }, close() {} },
    connect() {},
    disconnect() {},
  };
  const context = {
    destination: {},
    audioWorklet: { async addModule() {} },
  };
  return { context, node, messages };
}

describe("AudioWorkletMixerV2", () => {
  it("loads one processor and sends timestamped PCM chunks", async () => {
    const fake = fakeMixerContext();
    const mixer = createAudioWorkletMixerV2({
      context: fake.context,
      createNode: () => fake.node,
      moduleUrl: "/mixer.js",
    });
    expect(await mixer.ready).toBe(true);
    mixer.push({
      inputId: "video-audio",
      startSample: 480,
      sampleRate: 48000,
      channels: 2,
      data: new Float32Array([0.1, 0.2]),
      gain: 0.5,
      pan: -0.25,
    });
    expect(fake.messages).toEqual([
      { type: "reset", generation: 0 },
      expect.objectContaining({ type: "chunk", inputId: "video-audio", startSample: 480, generation: 0 }),
    ]);
    mixer.dispose();
  });

  it("does not advertise support or post data when AudioWorklet is unavailable", async () => {
    const mixer = createAudioWorkletMixerV2({ context: { destination: {} } });
    expect(mixer.supported).toBe(false);
    expect(await mixer.ready).toBe(false);
    mixer.push({ inputId: "a", startSample: 0, sampleRate: 48000, channels: 1, data: new Float32Array([1]), gain: 1, pan: 0 });
    mixer.dispose();
  });
});
