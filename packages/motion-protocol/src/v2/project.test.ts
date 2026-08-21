import { describe, expect, it } from "vitest";
import { isV2AtomCertified } from "./capabilities";
import { MotionProtocolV2Schema } from "./project";

const RECTANGLE_PROJECT = {
  format: "motion-protocol",
  formatVersion: 2,
  id: "project-v2",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#101820",
    colorSpace: "srgb",
    audioSampleRate: 48000,
  },
  layers: [
    {
      type: "shape",
      id: "rectangle",
      parentLayerId: null,
      zIndex: 0,
      frame: { width: 96, height: 64 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 100,
      timing: { start: 0, duration: 1 },
      payload: { shape: "rectangle" },
      style: { fill: "#00aa88" },
    },
  ],
};

describe("Motion Protocol V2 schema", () => {
  it("accepts the strict rectangle protocol", () => {
    expect(MotionProtocolV2Schema.parse(RECTANGLE_PROJECT)).toEqual(
      RECTANGLE_PROJECT,
    );
  });

  it("accepts ellipse as the second certified shape primitive", () => {
    const ellipse = {
      ...RECTANGLE_PROJECT,
      id: "ellipse-project-v2",
      layers: [
        {
          ...RECTANGLE_PROJECT.layers[0],
          id: "ellipse",
          payload: { shape: "ellipse" },
        },
      ],
    };
    expect(MotionProtocolV2Schema.parse(ellipse)).toEqual(ellipse);
  });

  it("rejects V1 and high-level fields at the protocol boundary", () => {
    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        formatVersion: 1,
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        bone: { id: "legacy" },
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [{ ...RECTANGLE_PROJECT.layers[0], depth: 100 }],
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          {
            ...RECTANGLE_PROJECT.layers[0],
            matrix4: Array.from({ length: 16 }, () => 0),
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          {
            ...RECTANGLE_PROJECT.layers[0],
            transform: {
              ...RECTANGLE_PROJECT.layers[0].transform,
              origin: { x: 0.5, y: 0.5 },
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate ids, duplicate z-indexes, and non-root atoms", () => {
    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          RECTANGLE_PROJECT.layers[0],
          { ...RECTANGLE_PROJECT.layers[0], zIndex: 1 },
        ],
      }),
    ).toThrow(/Duplicate layer id/);

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          RECTANGLE_PROJECT.layers[0],
          { ...RECTANGLE_PROJECT.layers[0], id: "second", zIndex: 0 },
        ],
      }),
    ).toThrow(/Duplicate zIndex/);

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          { ...RECTANGLE_PROJECT.layers[0], parentLayerId: "group" },
        ],
      }),
    ).toThrow(/root atoms/);

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        layers: [
          {
            ...RECTANGLE_PROJECT.layers[0],
            transform: {
              ...RECTANGLE_PROJECT.layers[0].transform,
              anchor: { x: Number.NaN, y: 0, z: 0 },
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("certifies rectangle and ellipse while keeping Path for Task 6", () => {
    expect(isV2AtomCertified("shape.rectangle.fill")).toBe(true);
    expect(isV2AtomCertified("shape.ellipse.fill")).toBe(true);
    expect(isV2AtomCertified("shape.path.fill")).toBe(false);
  });
});
