import { describe, expect, it } from "vitest";
import { identityMatrix4, orthographicProjectionMatrix } from "@motionvideo/motion-runtime";
import { createPlaybackEngineV2 } from "./playback-engine-v2";

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
});
