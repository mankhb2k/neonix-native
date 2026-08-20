import { describe, expect, it } from "vitest";
import { compileProtocolV2ToPaintCommands } from "./index";

const identity = {
  translate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotate: { x: 0, y: 0, z: 0 },
  skew: { x: 0, y: 0 },
  anchor: { x: 0, y: 0, z: 0 },
};

const base = {
  format: "motion-protocol" as const,
  formatVersion: 2 as const,
  id: "v2-rectangle",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#101820",
    colorSpace: "srgb" as const,
    audioSampleRate: 48000,
  },
};

describe("Protocol V2 Compiler B", () => {
  it("emits a valid empty frame", () => {
    const buffer = compileProtocolV2ToPaintCommands({ ...base, layers: [] });
    expect(buffer.commands.map((command) => command.op)).toEqual([
      "beginFrame",
      "endFrame",
    ]);
  });

  it("emits rectangle fill commands from atomic V2", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "rect",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle" },
          style: { fill: "#00aa88" },
        },
      ],
    });
    expect(buffer.commands).toEqual([
      expect.objectContaining({ op: "beginFrame", width: 320, height: 180 }),
      expect.objectContaining({ op: "setTransform", key: "rect" }),
      expect.objectContaining({
        op: "drawShape",
        key: "rect",
        shape: "rectangle",
        fill: "#00aa88",
        width: 80,
        height: 40,
      }),
      expect.objectContaining({ op: "endFrame" }),
    ]);
  });

  it("emits an ellipse without changing the shared transform contract", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "ellipse",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "ellipse" },
          style: { fill: "#00aa88" },
        },
      ],
    });
    expect(buffer.commands).toEqual([
      expect.objectContaining({ op: "beginFrame" }),
      expect.objectContaining({
        op: "setTransform",
        key: "ellipse",
        matrix4: expect.any(Array),
      }),
      expect.objectContaining({
        op: "drawShape",
        key: "ellipse",
        shape: "ellipse",
        width: 80,
        height: 40,
      }),
      expect.objectContaining({ op: "endFrame" }),
    ]);
  });

  it("lowers a certified rectangle stroke into the paint command", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "rect-stroke",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle" },
          style: { fill: "#00aa88", stroke: "#ff3366" },
        },
      ],
    });
    expect(buffer.commands).toContainEqual(
      expect.objectContaining({
        op: "drawShape",
        shape: "rectangle",
        stroke: "#ff3366",
        strokeWidth: 4,
      }),
    );
  });

  it("lowers a certified ellipse stroke into the paint command", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "ellipse-stroke",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "ellipse" },
          style: { fill: "#00aa88", stroke: "#ff3366" },
        },
      ],
    });
    expect(buffer.commands).toContainEqual(
      expect.objectContaining({
        op: "drawShape",
        shape: "ellipse",
        stroke: "#ff3366",
        strokeWidth: 4,
      }),
    );
  });

  it("lowers the frame view into backend-neutral projection matrices", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      composition: {
        ...base.composition,
        view: {
          projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
          transform: {
            translate: { x: 0, y: 0, z: 0 },
            rotate: { x: 0, y: 0, z: 0 },
          },
        },
      },
      layers: [],
    });
    const begin = buffer.commands[0];
    expect(begin?.op).toBe("beginFrame");
    if (!begin || begin.op !== "beginFrame") throw new Error("Missing beginFrame");
    expect(begin.projection?.viewMatrix).toHaveLength(16);
    expect(begin.projection?.projectionMatrix).toHaveLength(16);
    expect(begin.projection?.viewProjectionMatrix).toHaveLength(16);
    expect(begin.projection?.projectionMatrix?.[11]).toBe(-1);
  });

  it("lowers translate, scale, and local anchor into affine and Matrix4 outputs", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "rect",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 40, height: 20 },
          transform: {
            ...identity,
            translate: { x: 12, y: 8, z: 0 },
            scale: { x: 2, y: 3, z: 1 },
            anchor: { x: 20, y: 10, z: 0 },
          },
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle" },
          style: { fill: "#00aa88" },
        },
      ],
    });
    const transform = buffer.commands.find((command) => command.op === "setTransform");
    expect(transform).toMatchObject({
      matrix: { a: 2, b: 0, c: 0, d: 3, e: -8, f: -12 },
    });
    if (!transform || transform.op !== "setTransform") throw new Error("Missing transform");
    expect(transform.matrix4).toHaveLength(16);
    expect(transform.matrix4?.[12]).toBeCloseTo(-8, 8);
    expect(transform.matrix4?.[13]).toBeCloseTo(-12, 8);
  });

  it("lowers rotation and skew in the shared affine matrix", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "rect",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 40, height: 20 },
          transform: {
            ...identity,
            rotate: { x: 0, y: 0, z: 90 },
            skew: { x: 45, y: 0 },
            anchor: { x: 20, y: 10, z: 0 },
          },
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle" },
          style: { fill: "#00aa88" },
        },
      ],
    });
    const transform = buffer.commands.find((command) => command.op === "setTransform");
    if (!transform || transform.op !== "setTransform") throw new Error("Missing transform");
    expect(transform.matrix.a).toBeCloseTo(0, 8);
    expect(transform.matrix.b).toBeCloseTo(1, 8);
    expect(transform.matrix.c).toBeCloseTo(-1, 8);
    expect(transform.matrix.d).toBeCloseTo(1, 8);
    expect(transform.matrix.e).toBeCloseTo(30, 8);
    expect(transform.matrix.f).toBeCloseTo(-20, 8);
    expect(transform.matrix4).toHaveLength(16);
  });

  it("respects timing boundaries, opacity, and paint order", () => {
    const layers = [
      {
        id: "back",
        type: "shape" as const,
        parentLayerId: null,
        zIndex: 0,
        frame: { width: 80, height: 40 },
        transform: identity,
        opacity: 50,
        timing: { start: 1, duration: 1 },
        payload: { shape: "rectangle" as const },
        style: { fill: "#00aa88" },
      },
      {
        id: "front",
        type: "shape" as const,
        parentLayerId: null,
        zIndex: 1,
        frame: { width: 80, height: 40 },
        transform: identity,
        opacity: 100,
        timing: { start: 1, duration: 1 },
        payload: { shape: "rectangle" as const },
        style: { fill: "#ff3366" },
      },
    ];
    expect(
      compileProtocolV2ToPaintCommands({ ...base, layers }, { time: 0.999 }).commands.map(
        (command) => command.op,
      ),
    ).toEqual(["beginFrame", "endFrame"]);

    const active = compileProtocolV2ToPaintCommands({ ...base, layers }, { time: 1 });
    expect(active.commands.filter((command) => command.op === "setTransform")).toEqual([
      expect.objectContaining({ key: "back", alpha: 0.5, zIndex: 0 }),
      expect.objectContaining({ key: "front", alpha: 1, zIndex: 1 }),
    ]);
    expect(
      compileProtocolV2ToPaintCommands({ ...base, layers }, { time: 2 }).commands.map(
        (command) => command.op,
      ),
    ).toEqual(["beginFrame", "endFrame"]);
  });
});
