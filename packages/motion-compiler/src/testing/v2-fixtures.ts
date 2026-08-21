import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type V2FixtureShape = "rectangle" | "ellipse";

export const V2_DEFAULT_ORTHOGRAPHIC_VIEW = {
  projection: { kind: "orthographic" as const, zoom: 1, near: 1, far: 4000 },
  transform: {
    translate: { x: 0, y: 0, z: 0 },
    rotate: { x: 0, y: 0, z: 0 },
  },
};

export function v2Transform(
  overrides: Partial<MotionProtocolV2["layers"][number]["transform"]> = {},
): MotionProtocolV2["layers"][number]["transform"] {
  return {
    translate: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotate: { x: 0, y: 0, z: 0 },
    skew: { x: 0, y: 0 },
    anchor: { x: 0, y: 0, z: 0 },
    ...overrides,
  };
}

export function createV2ShapeProject(options: {
  id?: string;
  shape?: V2FixtureShape;
  width?: number;
  height?: number;
  background?: string;
  frameWidth?: number;
  frameHeight?: number;
  fill?: string;
  zIndex?: number;
  timing?: { start: number; duration: number };
  transform?: MotionProtocolV2["layers"][number]["transform"];
} = {}): MotionProtocolV2 {
  const frameWidth = options.frameWidth ?? 320;
  const frameHeight = options.frameHeight ?? 180;
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: options.id ?? `fixture-${options.shape ?? "rectangle"}`,
    composition: {
      width: options.width ?? 1920,
      height: options.height ?? 1080,
      fps: 30,
      background: options.background ?? "#101820",
      colorSpace: "srgb",
      audioSampleRate: 48000,
      view: V2_DEFAULT_ORTHOGRAPHIC_VIEW,
    },
    layers: [
      {
        id: "shape",
        type: "shape",
        parentLayerId: null,
        zIndex: options.zIndex ?? 0,
        frame: { width: frameWidth, height: frameHeight },
        transform: options.transform ?? v2Transform(),
        opacity: 100,
        timing: options.timing ?? { start: 0, duration: 3 },
        payload: { shape: options.shape ?? "rectangle" },
        style: { fill: options.fill ?? "#00B894" },
      },
    ],
  };
}

export function createV2OverlapProject(id = "fixture-overlap"): MotionProtocolV2 {
  const base = createV2ShapeProject({ id, frameWidth: 1200, frameHeight: 700 });
  const baseShape = base.layers[0]!;
  if (baseShape.type !== "shape") throw new Error("Expected shape fixture layer");
  return {
    ...base,
    layers: [
      {
        ...baseShape,
        id: "back",
        zIndex: 0,
        transform: v2Transform({ translate: { x: 360, y: 190, z: 0 } }),
        style: { fill: "#00B894" },
      },
      {
        ...baseShape,
        id: "front",
        zIndex: 1,
        frame: { width: 760, height: 460 },
        transform: v2Transform({ translate: { x: 600, y: 340, z: 0 } }),
        style: { fill: "#FF3366" },
      },
    ],
  };
}
