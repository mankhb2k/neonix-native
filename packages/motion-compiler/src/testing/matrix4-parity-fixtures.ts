import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { v2Transform } from "./v2-fixtures";

export type Matrix4ParityCase = {
  id:
  | "matrix4.2d.identity"
  | "matrix4.2d.rotate-z"
  | "matrix4.2d.skew"
  | "matrix4.3d.rotate-x"
  | "matrix4.3d.rotate-y"
  | "matrix4.3d.translate-z"
  | "matrix4.3d.anchor-z"
  | "matrix4.camera-plane";
  project: MotionProtocolV2;
  motion: boolean;
};

const perspectiveView: NonNullable<MotionProtocolV2["composition"]["view"]> = {
  projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
  },
};

const orthographicView: MotionProtocolV2["composition"]["view"] = {
  projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
  },
};

function project(
  id: string,
  transform: MotionProtocolV2["layers"][number]["transform"],
  view: MotionProtocolV2["composition"]["view"] = orthographicView,
): MotionProtocolV2 {
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
      view,
    },
    assets: [],
    layers: [
      {
        id: "parity-rectangle",
        type: "shape",
        parentLayerId: null,
        order: 0,
        frame: { width: 320, height: 180 },
        transform,
        opacity: 1,
        timing: { start: 0, duration: 3 },
        payload: { shape: "rectangle" },
        style: { fill: "#00aa88" },
      },
    ],
    audio: { sampleRate: 48000, tracks: [] },
  };
}

const cases: Matrix4ParityCase[] = [
  {
    id: "matrix4.2d.identity",
    project: project(
      "matrix4-2d-identity",
      v2Transform({ translate: { x: 800, y: 420, z: 0 } }),
    ),
    motion: false,
  },
  {
    id: "matrix4.2d.rotate-z",
    project: project(
      "matrix4-2d-rotate-z",
      v2Transform({
        translate: { x: 800, y: 420, z: 0 },
        rotate: { x: 0, y: 0, z: 18 },
        anchor: { x: 160, y: 90, z: 0 },
      }),
    ),
    motion: true,
  },
  {
    id: "matrix4.2d.skew",
    project: project(
      "matrix4-2d-skew",
      v2Transform({
        translate: { x: 800, y: 420, z: 0 },
        skew: { x: 18, y: -10 },
      }),
    ),
    motion: false,
  },
  {
    id: "matrix4.3d.rotate-x",
    project: project(
      "matrix4-3d-rotate-x",
      v2Transform({
        translate: { x: 800, y: 420, z: 160 },
        rotate: { x: 24, y: 0, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
      }),
      perspectiveView,
    ),
    motion: true,
  },
  {
    id: "matrix4.3d.rotate-y",
    project: project(
      "matrix4-3d-rotate-y",
      v2Transform({
        translate: { x: 800, y: 420, z: 160 },
        rotate: { x: 0, y: -24, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
      }),
      perspectiveView,
    ),
    motion: true,
  },
  {
    id: "matrix4.3d.translate-z",
    project: project(
      "matrix4-3d-translate-z",
      v2Transform({
        translate: { x: 800, y: 420, z: 240 },
        anchor: { x: 160, y: 90, z: 0 },
      }),
      perspectiveView,
    ),
    motion: true,
  },
  {
    id: "matrix4.3d.anchor-z",
    project: project(
      "matrix4-3d-anchor-z",
      v2Transform({
        translate: { x: 960, y: 540, z: 220 },
        rotate: { x: 0, y: 28, z: 0 },
        anchor: { x: 160, y: 90, z: 120 },
      }),
      perspectiveView,
    ),
    motion: true,
  },
  {
    id: "matrix4.camera-plane",
    project: (() => {
      const cameraPlaneProject = project(
        "matrix4-camera-plane",
        v2Transform({ translate: { x: 800, y: 420, z: 1100 } }),
        perspectiveView,
      );
      return {
        ...cameraPlaneProject,
        layers: [
          ...cameraPlaneProject.layers,
          {
            id: "camera-plane-reference",
            type: "shape" as const,
            parentLayerId: null,
            order: 1,
            frame: { width: 320, height: 180 },
            transform: v2Transform({
              translate: { x: 800, y: 420, z: 160 },
            }),
            opacity: 1,
            timing: { start: 0, duration: 3 },
            payload: { shape: "rectangle" as const },
            style: { fill: "#00aa88" },
          },
          {
            id: "camera-plane-origin-sentinel",
            type: "shape" as const,
            parentLayerId: null,
            order: 2,
            frame: { width: 96, height: 64 },
            transform: v2Transform({
              translate: { x: 32, y: 32, z: 0 },
            }),
            opacity: 1,
            timing: { start: 0, duration: 3 },
            payload: { shape: "rectangle" as const },
            style: { fill: "#ff3366" },
          },
        ],
      };
    })(),
    motion: false,
  },
];

export const MATRIX4_PARITY_CASES: readonly Matrix4ParityCase[] = cases;
