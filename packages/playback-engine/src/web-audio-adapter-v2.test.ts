import { describe, expect, it } from "vitest";
import type {
  RuntimeAudioMixPlanV2,
  RuntimeAudioSourceV2,
} from "@motionvideo/motion-runtime";
import { createWebAudioAdapterV2 } from "./web-audio-adapter-v2";

class FakeParam {
  value = 0;
  readonly calls: Array<{ op: string; value: number; time: number }> = [];

  cancelScheduledValues(time: number): void {
    this.calls.push({ op: "cancel", value: 0, time });
  }

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push({ op: "set", value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push({ op: "ramp", value, time });
  }
}

class FakeNode {
  readonly connections: unknown[] = [];
  disconnected = false;

  connect(destination: unknown): unknown {
    this.connections.push(destination);
    return destination;
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeSource extends FakeNode {
  buffer = null;
  playbackRate = new FakeParam();
  startCalls: Array<{ when: number; offset?: number; duration?: number }> = [];
  stopCalls = 0;
  onended: (() => void) | null = null;

  start(when: number, offset?: number, duration?: number): void {
    this.startCalls.push({ when, offset, duration });
  }

  stop(): void {
    this.stopCalls += 1;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakePanner extends FakeNode {
  pan = new FakeParam();
}

function createFakeContext(options: { resumeFails?: boolean } = {}) {
  const sources: FakeSource[] = [];
  const gains: FakeGain[] = [];
  const panners: FakePanner[] = [];
  let decodeCount = 0;
  const context = {
    currentTime: 5,
    sampleRate: 48000,
    state: "suspended" as "suspended" | "running" | "closed",
    destination: { kind: "destination" },
    createBufferSource() {
      const source = new FakeSource();
      sources.push(source);
      return source;
    },
    createGain() {
      const gain = new FakeGain();
      gains.push(gain);
      return gain;
    },
    createStereoPanner() {
      const panner = new FakePanner();
      panners.push(panner);
      return panner;
    },
    async decodeAudioData() {
      decodeCount += 1;
      return {
        duration: 2,
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 88200,
      };
    },
    async resume() {
      if (options.resumeFails) throw new Error("user gesture required");
      context.state = "running";
    },
  };
  return { context, sources, gains, panners, get decodeCount() { return decodeCount; } };
}

const source: RuntimeAudioSourceV2 = {
  assetId: "asset.music",
  kind: "audio",
  uri: "/audio/music.mp3",
  duration: 2,
  sampleRate: 44100,
  channels: 2,
  integrity: "sha256-test",
};

function planFor(
  overrides: Partial<RuntimeAudioMixPlanV2> = {},
): RuntimeAudioMixPlanV2 {
  return {
    sampleRate: 48000,
    startSample: 0,
    endSample: 4800,
    inputs: [{
      trackId: "music",
      clipId: "music-clip",
      assetId: source.assetId,
      source,
      sourceSampleRate: 44100,
      pan: 0.75,
      muted: false,
      compositionStartSample: 0,
      compositionEndSample: 4800,
      segments: [{
        compositionStartSample: 0,
        compositionEndSample: 4800,
        sourceStartSample: 0,
        sourceEndSample: 4410,
        loopIndex: 0,
        gainEnvelope: {
          baseGain: 0.5,
          fadeIn: { curve: "equal-power", start: 0, end: 1 },
        },
      }],
    }],
    ...overrides,
  };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("WebAudio Adapter V2", () => {
  it("decodes once, resamples to 48 kHz, and schedules the V2 graph", async () => {
    const fake = createFakeContext();
    const resampled: number[] = [];
    const adapter = createWebAudioAdapterV2({
      audioContext: fake.context,
      fetchSource: async () => new ArrayBuffer(8),
      resampleAudioBuffer: async (buffer, targetRate) => {
        resampled.push(targetRate);
        return { ...buffer, sampleRate: targetRate, length: 96000 };
      },
    });

    expect(await adapter.resume()).toBe(true);
    adapter.consumeAudioMixPlan(planFor(), { time: 0, preroll: false });
    await flushAsyncWork();
    adapter.consumeAudioMixPlan(planFor(), { time: 0.05, preroll: false });
    await flushAsyncWork();

    expect(fake.decodeCount).toBe(1);
    expect(resampled).toEqual([48000]);
    expect(fake.sources).toHaveLength(1);
    expect(fake.sources[0]!.startCalls[0]).toEqual({
      when: 5.01,
      offset: 0,
      duration: 0.1,
    });
    expect(fake.sources[0]!.playbackRate.value).toBeCloseTo(1, 8);
    expect(fake.gains[0]!.gain.calls.at(-2)?.value).toBe(0);
    expect(fake.gains[0]!.gain.calls.at(-1)?.value).toBeCloseTo(0.5, 8);
    expect(fake.panners[0]!.pan.value).toBe(0.75);
    expect(fake.sources[0]!.connections[0]).toBe(fake.gains[0]);
    expect(fake.gains[0]!.connections[0]).toBe(fake.panners[0]);
    expect(fake.panners[0]!.connections[0]).toBe(fake.context.destination);
    adapter.dispose();
  });

  it("does not schedule muted input and stops pending playback on seek", async () => {
    const fake = createFakeContext();
    let resolveFetch!: (data: ArrayBuffer) => void;
    const adapter = createWebAudioAdapterV2({
      audioContext: fake.context,
      fetchSource: () => new Promise<ArrayBuffer>((resolve) => {
        resolveFetch = resolve;
      }),
    });
    adapter.consumeAudioMixPlan(planFor({ inputs: [{
      ...planFor().inputs[0]!,
      muted: true,
    }] }), { time: 0, preroll: false });
    await flushAsyncWork();
    expect(fake.sources).toHaveLength(0);

    adapter.consumeAudioMixPlan(planFor(), { time: 0, preroll: false });
    adapter.seek(3);
    resolveFetch(new ArrayBuffer(8));
    await flushAsyncWork();
    expect(fake.sources).toHaveLength(0);
    adapter.dispose();
  });

  it("reports blocked autoplay instead of hiding the browser failure", async () => {
    const fake = createFakeContext({ resumeFails: true });
    const adapter = createWebAudioAdapterV2({ audioContext: fake.context });

    expect(await adapter.resume()).toBe(false);
    expect(adapter.state).toBe("suspended");
    expect(adapter.diagnostics).toContainEqual(expect.objectContaining({
      code: "audio-autoplay-blocked",
    }));
    adapter.dispose();
  });
});
