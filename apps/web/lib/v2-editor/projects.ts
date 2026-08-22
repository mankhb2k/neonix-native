import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

const ORTHOGRAPHIC_VIEW: MotionProtocolV2["composition"]["view"] = {
  projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
  },
};

function transform(
  translate: { x: number; y: number; z: number },
): MotionProtocolV2["layers"][number]["transform"] {
  return {
    translate,
    scale: { x: 1, y: 1, z: 1 },
    rotate: { x: 0, y: 0, z: 0 },
    skew: { x: 0, y: 0 },
    anchor: { x: 0, y: 0, z: 0 },
  };
}

function shapeLayer(input: {
  id: string;
  zIndex: number;
  fill: string;
  width: number;
  height: number;
  position: { x: number; y: number; z: number };
}): MotionProtocolV2["layers"][number] {
  return {
    id: input.id,
    type: "shape",
    parentLayerId: null,
    zIndex: input.zIndex,
    frame: { width: input.width, height: input.height },
    transform: transform(input.position),
    opacity: 100,
    timing: { start: 0, duration: 3 },
    payload: { shape: "rectangle", cornerRadius: 24 },
    style: { fill: input.fill, stroke: "#ffffff", strokeWidth: 4 },
  };
}

export function createV2EditorProject(
  projectId: string,
): MotionProtocolV2 {
  const isOverlap = projectId === "overlap";
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: `web-editor-${projectId}`,
    composition: {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#101820",
      colorSpace: "srgb",
      audioSampleRate: 48000,
      view: ORTHOGRAPHIC_VIEW,
    },
    layers: isOverlap
      ? [
          shapeLayer({
            id: "back",
            zIndex: 0,
            fill: "#00B894",
            width: 1200,
            height: 700,
            position: { x: 360, y: 190, z: 0 },
          }),
          shapeLayer({
            id: "front",
            zIndex: 1,
            fill: "#FF3366",
            width: 760,
            height: 460,
            position: { x: 600, y: 340, z: 0 },
          }),
        ]
      : [
          shapeLayer({
            id: "shape",
            zIndex: 0,
            fill: "#00B894",
            width: 960,
            height: 540,
            position: { x: 480, y: 270, z: 0 },
          }),
        ],
  };
}

export function isV2EditorProjectId(value: string): boolean {
  return value === "shape" || value === "overlap";
}
