import { describe, expect, it } from "vitest";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { evaluateRuntimeProjectV2 } from "@motionvideo/motion-runtime";
import { rasterRuntimeFrameV2, runtimeProjectV2Duration } from "./render-v2";

const protocol = {
  format: "motion-protocol" as const,
  formatVersion: 2 as const,
  id: "render-worker-v2",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#101820",
    colorSpace: "srgb" as const,
    audioSampleRate: 48000,
    view: {
      projection: { kind: "perspective" as const, fov: 60, near: 1, far: 4000 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        rotate: { x: 0, y: 0, z: 0 },
      },
    },
  },
  layers: [
    {
      id: "rect",
      type: "shape" as const,
      parentLayerId: null,
      zIndex: 0,
      frame: { width: 120, height: 80 },
      transform: {
        translate: { x: 80, y: 50, z: 100 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 12, y: -10, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 60, y: 40, z: 0 },
      },
      opacity: 100,
      timing: { start: 0, duration: 1 },
      payload: { shape: "rectangle" as const },
      style: { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 4 },
    },
  ],
};

describe("render-worker V2 raster path", () => {
  it("rasterizes the same evaluated Matrix4 frame used by preview", () => {
    const runtime = compileProtocolV2(protocol);
    const frame = evaluateRuntimeProjectV2(runtime, 0);
    const png = rasterRuntimeFrameV2(frame, 320, 180);

    expect(runtimeProjectV2Duration(runtime)).toBe(1);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.length).toBeGreaterThan(1000);
  });
});
