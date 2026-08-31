import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "../v2/project";
import {
  V2MaskCompositeOperatorSchema,
  V2MaskStackSchema,
} from "../v2/layers/base";

const maskStack = [
  {
    sourceLayerId: "mask-a",
    mode: "alpha" as const,
    sourceVisibility: "mask-only" as const,
    composite: "add" as const,
  },
  {
    sourceLayerId: "mask-b",
    mode: "luma" as const,
    sourceVisibility: "mask-only" as const,
    composite: "intersect" as const,
  },
  {
    sourceLayerId: "mask-c",
    mode: "inverse-alpha" as const,
    sourceVisibility: "mask-only" as const,
    composite: "subtract" as const,
  },
];

describe("Protocol V2 multi-mask schema", () => {
  it("accepts ordered CSS mask-composite operators", () => {
    expect(V2MaskStackSchema.parse(maskStack)).toEqual(maskStack);
    for (const operator of ["add", "subtract", "intersect", "exclude"] as const) {
      expect(V2MaskCompositeOperatorSchema.parse(operator)).toBe(operator);
    }
  });

  it("requires at least one mask layer in a stack", () => {
    expect(() => V2MaskStackSchema.parse([])).toThrow();
  });

  it("accepts a mask stack composed from direct group children", () => {
    const group = {
      id: "group",
      type: "group" as const,
      parentLayerId: null,
      order: 0,
      frame: { width: 320, height: 180 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 1000 },
      composite: { masks: [{ ...maskStack[0], sourceLayerId: "mask-a" }] },
    };
    const source = (id: string) => ({
      id,
      type: "shape" as const,
      parentLayerId: "group",
      order: 0,
      frame: { width: 320, height: 180 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 1000 },
      payload: { shape: "rectangle" as const },
      style: { fill: "#ffffff" },
    });
    const project = {
      format: "motion-protocol" as const,
      formatVersion: 2 as const,
      id: "mask-project",
      composition: {
        width: 320,
        height: 180,
        fps: 30,
        background: "#000000",
        colorSpace: "srgb" as const,
        view: {
          projection: { kind: "orthographic" as const, zoom: 1, near: 1, far: 4000 },
          transform: {
            translate: { x: 0, y: 0, z: 0 },
            rotate: { x: 0, y: 0, z: 0 },
          },
        },
      },
      assets: [],
      layers: [group, source("mask-a")],
      audio: { sampleRate: 48000, tracks: [] },
    };
    expect(MotionProtocolV2Schema.parse(project).layers[0]).toMatchObject({
      composite: { masks: [{ composite: "add" }] },
    });
  });
});
