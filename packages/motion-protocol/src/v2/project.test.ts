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
    view: {
      projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        rotate: { x: 0, y: 0, z: 0 },
      },
    },
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

  it("accepts an open stroke-only path with join, cap, and dash semantics", () => {
    const path = {
      ...RECTANGLE_PROJECT,
      id: "open-path-project-v2",
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        id: "open-path",
        type: "path" as const,
        frame: { width: 160, height: 40 },
        payload: {
          contours: [{
            id: "line",
            start: { x: 0, y: 20 },
            segments: [{ kind: "line" as const, to: { x: 160, y: 20 } }],
            closed: false,
          }],
          fillRule: "nonzero" as const,
        },
        style: {
          stroke: "#ff3366",
          strokeWidth: 8,
          strokeJoin: "round" as const,
          strokeCap: "round" as const,
          strokeDash: { array: [12, 6], offset: 2 },
        },
      }],
    };
    expect(MotionProtocolV2Schema.parse(path)).toEqual(path);
  });

  it("requires one explicit view projection with complete parameters", () => {
    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        composition: {
          ...RECTANGLE_PROJECT.composition,
          view: undefined,
        },
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        composition: {
          ...RECTANGLE_PROJECT.composition,
          view: {
            ...RECTANGLE_PROJECT.composition.view,
            projection: { kind: "orthographic", zoom: 1, near: 1 },
          },
        },
      }),
    ).toThrow();

    expect(() =>
      MotionProtocolV2Schema.parse({
        ...RECTANGLE_PROJECT,
        composition: {
          ...RECTANGLE_PROJECT.composition,
          view: {
            ...RECTANGLE_PROJECT.composition.view,
            projection: { kind: "perspective", fov: 60, near: 4, far: 1 },
          },
        },
      }),
    ).toThrow(/far must be greater/);
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

  it("accepts group parents and rejects invalid hierarchy", () => {
    const group = {
      id: "group",
      type: "group" as const,
      parentLayerId: null,
      zIndex: 0,
      frame: RECTANGLE_PROJECT.layers[0].frame,
      transform: RECTANGLE_PROJECT.layers[0].transform,
      opacity: 100,
      timing: RECTANGLE_PROJECT.layers[0].timing,
    };
    const child = {
      ...RECTANGLE_PROJECT.layers[0],
      id: "child",
      parentLayerId: "group",
      zIndex: 1,
    };
    expect(MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [group, child],
    }).layers).toHaveLength(2);

    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [{ ...RECTANGLE_PROJECT.layers[0], parentLayerId: "missing" }],
    })).toThrow(/Unknown parent layer/);

    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [
        { ...group, parentLayerId: "child" },
        child,
      ],
    })).toThrow(/cycle/);

    expect(() => MotionProtocolV2Schema.parse({
      ...RECTANGLE_PROJECT,
      layers: [
        { ...RECTANGLE_PROJECT.layers[0], id: "parent", type: "shape" as const },
        { ...RECTANGLE_PROJECT.layers[0], id: "child", parentLayerId: "parent", zIndex: 1 },
      ],
    })).toThrow(/Only group layers/);
  });

  it("rejects duplicate ids and duplicate z-indexes", () => {
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

  it("certifies rectangle, ellipse, and the completed static Path surface", () => {
    expect(isV2AtomCertified("shape.rectangle.fill")).toBe(true);
    expect(isV2AtomCertified("shape.ellipse.fill")).toBe(true);
    expect(isV2AtomCertified("path.fill")).toBe(true);
    expect(isV2AtomCertified("path.strokeDash")).toBe(true);
    expect(isV2AtomCertified("path.morph")).toBe(true);
    expect(isV2AtomCertified("group.transform")).toBe(true);
    expect(isV2AtomCertified("group.timing")).toBe(true);
    expect(isV2AtomCertified("group.opacity")).toBe(true);
    expect(isV2AtomCertified("shape.path.fill")).toBe(false);
  });
});
