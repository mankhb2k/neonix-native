import { describe, expect, it } from "vitest";
import {
  identityMatrix4,
  orthographicProjectionMatrix,
  type RuntimeAudioMixPlanV2,
} from "@motionvideo/motion-runtime";
import {
  createPlaybackEngineV2,
  type PlaybackV2Snapshot,
} from "./playback-engine-v2";

const runtime = {
  format: "motion-runtime" as const,
  formatVersion: 2 as const,
  id: "playback-v2",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#101820",
    graphId: "playback-v2",
  },
  view: {
    worldToClipMatrix: orthographicProjectionMatrix(320, 180, 1, 1, 4000),
  },
  nodes: [
    {
      id: "rect",
      parentId: null,
      order: 0,
      timing: { start: 0, duration: 2 },
      opacity: 1,
      visible: true,
      localMatrix: identityMatrix4(),
      worldMatrix: identityMatrix4(),
      content: {
        kind: "shape" as const,
        shape: "rectangle" as const,
        width: 80,
        height: 40,
        fill: "#00aa88",
      },
    },
  ],
};

const audioOnlyRuntime = {
  ...runtime,
  id: "playback-audio-only-v2",
  nodes: [],
  audio: {
    sampleRate: 48000 as const,
    tracks: [
      {
        id: "music",
        gainDb: 0,
        pan: 0,
        muted: false,
        clips: [
          {
            id: "music-clip",
            assetId: "music-asset",
            source: {
              assetId: "music-asset",
              kind: "audio" as const,
              uri: "/audio/music.mp3",
              duration: 4,
              sampleRate: 48000,
              channels: 2,
            },
            timing: { start: 1, duration: 3 },
            trim: { start: 0, end: 4 },
            playbackRate: 1,
            loop: false,
            gainDb: 0,
          },
        ],
      },
    ],
  },
};

describe("Playback Engine V2", () => {
  it("evaluates and paints exactly once for each rendered transport frame", () => {
    let paintCount = 0;
    const engine = createPlaybackEngineV2({
      paintCompositionFrame() {
        paintCount += 1;
      },
    });

    engine.load(runtime);
    expect(paintCount).toBe(0);
    engine.seek(0.5);
    expect(paintCount).toBe(1);
    engine.previewFrameAt(1);
    expect(paintCount).toBe(2);
    engine.dispose();
  });

  it("synchronizes media before notifying the visual frame consumer", () => {
    const order: string[] = [];
    const engine = createPlaybackEngineV2(
      {
        paintCompositionFrame() {
          order.push("paint");
        },
      },
      {
        media: {
          sync() {
            order.push("media");
          },
          pauseAll() {},
          dispose() {},
        },
      },
    );

    engine.load(runtime);
    engine.seek(0.5);
    expect(order).toEqual(["media", "paint"]);
    engine.dispose();
  });

  it("publishes one snapshot stream for render, play, pause, and seek", () => {
    const snapshots: Array<{ time: number; playing: boolean; frame: number | null }> = [];
    const engine = createPlaybackEngineV2({
      onSnapshot(snapshot) {
        snapshots.push({
          time: snapshot.time,
          playing: snapshot.playing,
          frame: snapshot.frame?.frame ?? null,
        });
      },
    });

    engine.load(runtime);
    engine.seek(0.5);
    engine.play();
    engine.pause();
    const unsubscribe = engine.subscribe((snapshot) => {
      snapshots.push({
        time: snapshot.time,
        playing: snapshot.playing,
        frame: snapshot.frame?.frame ?? null,
      });
    });
    engine.seek(1);
    unsubscribe();

    expect(snapshots).toEqual(expect.arrayContaining([
      { time: 0.5, playing: false, frame: 15 },
      { time: 0.5, playing: true, frame: 15 },
      { time: 0.5, playing: false, frame: 15 },
      { time: 1, playing: false, frame: 30 },
    ]));
    engine.dispose();
  });

  it("exposes transport generation and active media/audio ids for diagnostics", () => {
    const snapshots: Array<{
      generation: number;
      visual: readonly string[];
      audio: readonly string[];
    }> = [];
    const engine = createPlaybackEngineV2({
      onSnapshot(snapshot) {
        snapshots.push({
          generation: snapshot.generation,
          visual: snapshot.activeVisualMediaIds,
          audio: snapshot.activeAudioInputIds,
        });
      },
    });

    engine.load(audioOnlyRuntime);
    engine.seek(1);
    const snapshot = snapshots.at(-1)!;
    expect(snapshot.generation).toBeGreaterThan(0);
    expect(snapshot.visual).toEqual([]);
    expect(snapshot.audio).toEqual(["music:music-clip"]);
    engine.dispose();
  });

  it("propagates one generation to audio, media, and frame consumers", () => {
    const generations = {
      audio: [] as number[],
      media: [] as number[],
      frame: [] as number[],
    };
    const engine = createPlaybackEngineV2(
      {
        consumeAudioMixPlan(_plan, context) {
          generations.audio.push(context.generation);
        },
        paintCompositionFrame(_frame, context) {
          generations.frame.push(context.generation);
        },
      },
      {
        media: {
          sync(_commands, context) {
            generations.media.push(context.generation);
          },
          pauseAll() {},
          dispose() {},
        },
      },
    );

    engine.load(audioOnlyRuntime);
    engine.seek(1);

    expect(generations.audio.at(-1)).toBe(generations.frame.at(-1));
    expect(generations.media.at(-1)).toBe(generations.frame.at(-1));
    engine.dispose();
  });

  it("hands active video commands to the media controller and pauses it", () => {
    const syncs: Array<{ count: number; playing: boolean }> = [];
    let paused = 0;
    let disposed = 0;
    const engine = createPlaybackEngineV2({}, {
      media: {
        sync(commands, context) {
          syncs.push({ count: commands.length, playing: context.playing });
        },
        pauseAll() {
          paused += 1;
        },
        dispose() {
          disposed += 1;
        },
      },
    });

    engine.load(runtime);
    engine.renderAt(0);
    engine.pause();
    engine.dispose();

    expect(syncs.at(-1)).toEqual({ count: 0, playing: false });
    expect(paused).toBeGreaterThanOrEqual(2);
    expect(disposed).toBe(1);
  });

  it("evaluates RuntimeProjectV2 frames without a compiler or V1 scene", () => {
    const frames: number[] = [];
    const engine = createPlaybackEngineV2({
      paintCompositionFrame(frame) {
        frames.push(frame.frame);
      },
    });

    engine.load(runtime);
    expect(engine.duration).toBe(2);
    const frame = engine.renderFrameAt(1);

    expect(frame?.runtimeVersion).toBe(2);
    expect(frame?.commands).toContainEqual(expect.objectContaining({ op: "drawShape" }));
    expect(frames).toEqual([30]);
  });

  it("previews a scrubbed frame without scheduling audio", () => {
    const frames: number[] = [];
    const audioEvents: RuntimeAudioMixPlanV2[] = [];
    const prefetchedAudioPlans: RuntimeAudioMixPlanV2[] = [];
    const engine = createPlaybackEngineV2({
      paintCompositionFrame(frame) {
        frames.push(frame.frame);
      },
      consumeAudioMixPlan(plan) {
        audioEvents.push(plan);
      },
      prefetchAudioMixPlan(plan) {
        prefetchedAudioPlans.push(plan);
      },
    });

    engine.load(runtime);
    const frame = engine.previewFrameAt(1);

    expect(frame?.frame).toBe(30);
    expect(frames).toEqual([30]);
    expect(audioEvents).toHaveLength(0);
    expect(prefetchedAudioPlans).toHaveLength(1);
    expect(prefetchedAudioPlans[0]?.inputs).toHaveLength(0);
    expect(engine.currentTime).toBe(1);
    expect(engine.playing).toBe(false);
    engine.dispose();
  });

  it("prefetches the current audio with a 250 ms default look-ahead", () => {
    const scheduled: RuntimeAudioMixPlanV2[] = [];
    const prefetched: RuntimeAudioMixPlanV2[] = [];
    const engine = createPlaybackEngineV2({
      consumeAudioMixPlan(plan) {
        scheduled.push(plan);
      },
      prefetchAudioMixPlan(plan) {
        prefetched.push(plan);
      },
    });

    engine.load(audioOnlyRuntime);
    engine.previewFrameAt(1);

    expect(scheduled).toHaveLength(0);
    expect(prefetched).toHaveLength(1);
    expect(prefetched[0]).toMatchObject({
      startSample: 48000,
      endSample: 60000,
      inputs: [expect.objectContaining({ clipId: "music-clip" })],
    });
    engine.dispose();
  });

  it("schedules realtime V2 frames from the monotonic clock", () => {
    let now = 0;
    const callbacks: Array<() => void> = [];
    const frames: number[] = [];
    const engine = createPlaybackEngineV2({
      paintCompositionFrame(frame) {
        frames.push(frame.frame);
      },
    }, {
      scheduler: {
        now: () => now,
        request(callback) {
          callbacks.push(callback);
          return callback;
        },
        cancel(handle) {
          const index = callbacks.indexOf(handle as () => void);
          if (index >= 0) callbacks.splice(index, 1);
        },
      },
    });

    engine.load(runtime);
    engine.seek(0);
    engine.play();
    expect(engine.playing).toBe(true);
    now = 0.5 * 1000;
    callbacks.shift()?.();

    expect(engine.currentTime).toBeCloseTo(0.5, 5);
    expect(frames.at(-1)).toBe(15);
    engine.pause();
    expect(engine.playing).toBe(false);
    engine.dispose();
  });

  it("reports play latency, render cost, and scheduler frame gaps", () => {
    let now = 0;
    const callbacks: Array<() => void> = [];
    const engine = createPlaybackEngineV2({
      paintCompositionFrame() {
        now += 2;
      },
    }, {
      collectPerformanceMetrics: true,
      media: {
        sync() {
          now += 3;
        },
        pauseAll() {},
        dispose() {},
      },
      scheduler: {
        now: () => now,
        request(callback) {
          callbacks.push(callback);
          return callback;
        },
        cancel(handle) {
          const index = callbacks.indexOf(handle as () => void);
          if (index >= 0) callbacks.splice(index, 1);
        },
      },
    });

    engine.load(runtime);
    engine.play();
    now = 20;
    callbacks.shift()?.();
    expect(engine.currentTime).toBeCloseTo(0.025, 5);

    now = 90;
    callbacks.shift()?.();
    let latestPerformance = null as PlaybackV2Snapshot["performance"] | null;
    const unsubscribe = engine.subscribe((snapshot) => {
      latestPerformance = snapshot.performance;
    });

    expect(latestPerformance).toEqual(expect.objectContaining({
      playToFirstFrameMs: 20,
      consumerMs: 2,
      mediaSyncMs: 3,
      renderMs: 5,
      longFrameCount: 1,
      estimatedDroppedFrames: 1,
    }));
    unsubscribe();
    engine.dispose();
  });

  it("keeps a bounded performance sample history for diagnostics", () => {
    const engine = createPlaybackEngineV2(
      {},
      { collectPerformanceMetrics: true, performanceSampleCapacity: 2 },
    );

    engine.load(runtime);
    engine.renderAt(0.1);
    engine.renderAt(0.2);
    engine.renderAt(0.3);

    const samples = engine.getPerformanceSamples();
    expect(samples).toHaveLength(2);
    expect(samples.map((sample) => sample.time)).toEqual([0.2, 0.3]);
    expect(samples.every((sample) => Number.isFinite(sample.renderMs))).toBe(true);
    engine.dispose();
  });

  it("coordinates visual time and audio sample ranges from one clock", () => {
    const visualTimes: number[] = [];
    const audioEvents: Array<{ time: number; preroll: boolean; start: number; end: number }> = [];
    const engine = createPlaybackEngineV2({
      paintCompositionFrame(frame) {
        visualTimes.push(frame.time);
      },
      consumeAudioMixPlan(plan, context) {
        audioEvents.push({
          time: context.time,
          preroll: context.preroll,
          start: plan.startSample,
          end: plan.endSample,
        });
      },
    }, { audio: { blockDuration: 0.1, seekPreroll: 0.05 } });

    engine.load(audioOnlyRuntime);
    expect(engine.duration).toBe(4);
    engine.seek(1.2);

    const event = audioEvents.at(-1)!;
    expect(visualTimes.at(-1)).toBe(1.2);
    expect(event.time).toBe(1.2);
    expect(event.preroll).toBe(true);
    expect(event.start).toBe(55200);
    expect(event.end).toBe(62400);

    const output = engine.renderAt(2);
    expect(output?.time).toBe(2);
    expect(output?.frame.commands).not.toContainEqual(expect.objectContaining({ op: "drawShape" }));
    expect(output?.audioPlan.inputs[0]?.clipId).toBe("music-clip");
    expect(audioEvents.at(-1)?.time).toBe(2);
    expect(audioEvents.at(-1)?.preroll).toBe(false);
  });

  it("supports pause, resume, and end-of-project for audio-only projects", () => {
    let now = 0;
    const callbacks: Array<() => void> = [];
    const audioTimes: number[] = [];
    const engine = createPlaybackEngineV2({
      consumeAudioMixPlan(_plan, context) {
        audioTimes.push(context.time);
      },
    }, {
      scheduler: {
        now: () => now,
        request(callback) {
          callbacks.push(callback);
          return callback;
        },
        cancel(handle) {
          const index = callbacks.indexOf(handle as () => void);
          if (index >= 0) callbacks.splice(index, 1);
        },
      },
    });

    engine.load(audioOnlyRuntime);
    engine.play();
    now = 1.5 * 1000;
    callbacks.shift()?.();
    expect(engine.currentTime).toBeCloseTo(1.5, 5);

    engine.pause();
    now = 2.5 * 1000;
    expect(engine.currentTime).toBeCloseTo(1.5, 5);
    engine.play();
    now = 5.5 * 1000;
    callbacks.shift()?.();

    expect(engine.currentTime).toBe(4);
    expect(engine.playing).toBe(false);
    expect(audioTimes.at(-1)).toBe(4);
    engine.dispose();
  });

  it("loops the project transport without looping any layer", () => {
    let now = 0;
    const callbacks: Array<() => void> = [];
    const times: number[] = [];
    const engine = createPlaybackEngineV2({
      onSnapshot(snapshot) {
        times.push(snapshot.time);
      },
    }, {
      timelineLoop: true,
      scheduler: {
        now: () => now,
        request(callback) {
          callbacks.push(callback);
          return callback;
        },
        cancel(handle) {
          const index = callbacks.indexOf(handle as () => void);
          if (index >= 0) callbacks.splice(index, 1);
        },
      },
    });

    engine.load(runtime);
    engine.play();
    now = 2.1 * 1000;
    callbacks.shift()?.();

    expect(engine.playing).toBe(true);
    expect(engine.currentTime).toBe(0);
    expect(times.at(-1)).toBe(0);
    engine.dispose();
  });
});
