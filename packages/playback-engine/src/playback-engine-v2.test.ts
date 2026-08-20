import { describe, expect, it } from "vitest";
import { IDENTITY_MATRIX4, orthographicMatrix2D } from "@motionvideo/motion-runtime";
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
    viewMatrix: IDENTITY_MATRIX4,
    projectionMatrix: orthographicMatrix2D(320, 180),
    viewProjectionMatrix: orthographicMatrix2D(320, 180),
  },
  nodes: [
    {
      id: "rect",
      parentId: null,
      zIndex: 0,
      timing: { start: 0, duration: 2 },
      opacity: 1,
      visible: true,
      localMatrix: IDENTITY_MATRIX4,
      worldMatrix: IDENTITY_MATRIX4,
      matrix2D: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
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
});
