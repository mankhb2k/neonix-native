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
    adapter.consumeAudioMixPlan(planFor(), { time: 0, preroll: false, generation: 0 });
    await flushAsyncWork();
    adapter.consumeAudioMixPlan(planFor(), { time: 0.05, preroll: false, generation: 0 });
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
    }] }), { time: 0, preroll: false, generation: 0 });
    await flushAsyncWork();
    expect(fake.sources).toHaveLength(0);

    adapter.consumeAudioMixPlan(planFor(), { time: 0, preroll: false, generation: 0 });
    adapter.seek(3);
    resolveFetch(new ArrayBuffer(8));
    await flushAsyncWork();
    expect(fake.sources).toHaveLength(0);
    adapter.dispose();
  });

  it("bounds the decoded buffer cache while retaining active sources", async () => {
    const fake = createFakeContext();
    const adapter = createWebAudioAdapterV2({
      audioContext: fake.context,
      maxCachedBuffers: 1,
      fetchSource: async () => new ArrayBuffer(8),
    });
    expect(await adapter.resume()).toBe(true);
    for (const [index, assetId] of ["asset.a", "asset.b", "asset.c"].entries()) {
      adapter.consumeAudioMixPlan(planFor({
        inputs: [{ ...planFor().inputs[0]!, clipId: `clip-${index}`, assetId, source: { ...source, assetId } }],
      }), { time: 0, preroll: false, generation: 0 });
      await flushAsyncWork();
    }

    expect(adapter.getResourceStats().cachedBuffers).toBeLessThanOrEqual(1);
    adapter.dispose();
    expect(adapter.getResourceStats()).toEqual({
      cachedBuffers: 0,
      activeSources: 0,
      lateScheduleCount: 0,
      maxScheduleLateMs: 0,
    });
  });

  it("uses source-buffer duration when a clip is time-remapped", async () => {
    const fake = createFakeContext();
    const adapter = createWebAudioAdapterV2({
      audioContext: fake.context,
      fetchSource: async () => new ArrayBuffer(8),
      resampleAudioBuffer: async (buffer) => ({ ...buffer, sampleRate: 48000, length: 96000 }),
    });

    // 0.2 source seconds compressed into 0.1 composition seconds is 2x.
    adapter.consumeAudioMixPlan(planFor({
      inputs: [{
        ...planFor().inputs[0]!,
        compositionEndSample: 4800,
        segments: [{
          ...planFor().inputs[0]!.segments[0]!,
          compositionEndSample: 4800,
          sourceEndSample: 8820,
        }],
      }],
    }), { time: 0, preroll: false, generation: 0 });
    await flushAsyncWork();

    expect(fake.sources[0]!.playbackRate.value).toBeCloseTo(2, 8);
    // `start(..., duration)` is in buffer seconds, not timeline seconds.
    expect(fake.sources[0]!.startCalls[0]?.duration).toBeCloseTo(0.2, 8);
    adapter.dispose();
  });

  it("schedules overlapping inputs as independent mix sources", async () => {
    const fake = createFakeContext();
    const first = planFor().inputs[0]!;
    const adapter = createWebAudioAdapterV2({
      audioContext: fake.context,
      fetchSource: async () => new ArrayBuffer(8),
      resampleAudioBuffer: async (buffer) => ({ ...buffer, sampleRate: 48000, length: 96000 }),
    });

    adapter.consumeAudioMixPlan(planFor({
      inputs: [
        first,
        { ...first, clipId: "music-clip-overlap", trackId: "music-overlap" },
      ],
    }), { time: 0, preroll: false, generation: 0 });
    await flushAsyncWork();

    expect(fake.sources).toHaveLength(2);
    expect(adapter.getResourceStats().activeSources).toBe(2);
    adapter.dispose();
  });

  it("preloads paused-preview sources without creating audible nodes", async () => {
    const fake = createFakeContext();
    const adapter = createWebAudioAdapterV2({
      audioContext: fake.context,
      fetchSource: async () => new ArrayBuffer(8),
      resampleAudioBuffer: async (buffer) => ({ ...buffer, sampleRate: 48000, length: 96000 }),
    });

    adapter.prefetchAudioMixPlan(planFor());
    await flushAsyncWork();

    expect(fake.decodeCount).toBe(1);
    expect(fake.sources).toHaveLength(0);
    expect(adapter.getResourceStats().cachedBuffers).toBe(1);
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

  it("reports a derivative hint when embedded video audio cannot be decoded", async () => {
    const fake = createFakeContext();
    const adapter = createWebAudioAdapterV2({
      audioContext: fake.context,
      fetchSource: async () => new ArrayBuffer(8),
      decodeAudioData: async () => {
        throw new Error("The encoded media is not an audio file");
      },
    });

    adapter.consumeAudioMixPlan(planFor({
      inputs: [{
        ...planFor().inputs[0]!,
        assetId: "asset.video",
        source: { ...source, assetId: "asset.video", kind: "video" },
      }],
    }), { time: 0, preroll: false, generation: 0 });
    await flushAsyncWork();

    expect(adapter.diagnostics).toContainEqual(expect.objectContaining({
      code: "audio-decode-failed",
      assetId: "asset.video",
      message: expect.stringContaining("audio derivative"),
    }));
    adapter.dispose();
  });

  it("prepares a derivative before play and never fetches a video container as audio", async () => {
    const fake = createFakeContext();
    const fetched: string[] = [];
    const adapter = createWebAudioAdapterV2({
      audioContext: fake.context,
      fetchSource: async (uri) => {
        fetched.push(uri);
        return new ArrayBuffer(8);
      },
      resampleAudioBuffer: async (buffer) => ({ ...buffer, sampleRate: 48000 }),
    });
    const derivativePlan = planFor({ inputs: [{
      ...planFor().inputs[0]!,
      source: {
        ...source,
        kind: "video",
        audioUri: "/video/audio.m4a",
      },
    }] });
    expect(await adapter.prepareAudioMixPlan(derivativePlan)).toBe(true);
    expect(fetched).toEqual(["/video/audio.m4a"]);
    fetched.length = 0;
    expect(await adapter.prepareAudioMixPlan(planFor({ inputs: [{
      ...planFor().inputs[0]!,
      source: { ...source, kind: "video" },
    }] }))).toBe(false);
    expect(fetched).toEqual([]);
    adapter.dispose();
  });
});
