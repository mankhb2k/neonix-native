import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export function createV2ShapeProject(id: string): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id,
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#101820",
      colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    },
    assets: [],
    layers: [{
      id: "shape",
      type: "shape",
      parentLayerId: null,
      zIndex: 0,
      frame: { width: 320, height: 180 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3 },
      payload: { shape: "rectangle" },
      style: { fill: "#00B894" },
    }],
    audio: { sampleRate: 48000, tracks: [] },
  };
}
