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
      zIndex: 0,
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
});
