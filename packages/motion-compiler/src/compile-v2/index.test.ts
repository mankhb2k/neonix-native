import { describe, expect, it } from "vitest";
import {
  multiplyMatrix4,
  rotationMatrixX,
  rotationMatrixY,
  rotationMatrixZ,
  translationMatrix3D,
  transformPoint4,
} from "@motionvideo/motion-runtime";
import { compileProtocolV2, compileProtocolV2ToPaintCommands } from "./index";

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
  it("emits RuntimeProjectV2 before frame evaluation", () => {
    const runtime = compileProtocolV2({
      ...base,
      layers: [
        {
          id: "runtime-rect",
          type: "shape",
          parentLayerId: null,
          zIndex: 2,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 75,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle" },
          style: { fill: "#00aa88" },
        },
      ],
    });

    expect(runtime).toMatchObject({
      format: "motion-runtime",
      formatVersion: 2,
      id: "v2-rectangle",
      composition: { width: 320, height: 180, fps: 30 },
    });
    expect(runtime.nodes).toHaveLength(1);
    expect(runtime.nodes[0]).toMatchObject({
      id: "runtime-rect",
      zIndex: 2,
      opacity: 0.75,
      content: { kind: "shape", shape: "rectangle", fill: "#00aa88" },
    });
    expect(runtime.nodes[0]?.localMatrix).toHaveLength(16);
    expect(runtime.nodes[0]?.worldMatrix).toHaveLength(16);
    expect(runtime.view.viewProjectionMatrix).toHaveLength(16);
  });

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

  it("preserves a custom local stroke width", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "rect-wide-stroke",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle" },
          style: { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 16 },
        },
      ],
    });
    expect(buffer.commands).toContainEqual(
      expect.objectContaining({
        op: "drawShape",
        shape: "rectangle",
        strokeWidth: 16,
      }),
    );
  });

  it("rejects a stroke width without a stroke color", () => {
    expect(() =>
      compileProtocolV2ToPaintCommands({
        ...base,
        layers: [
          {
            id: "invalid-stroke-width",
            type: "shape",
            parentLayerId: null,
            zIndex: 0,
            frame: { width: 80, height: 40 },
            transform: identity,
            opacity: 100,
            timing: { start: 0, duration: 1 },
            payload: { shape: "rectangle" },
            style: { fill: "#00aa88", strokeWidth: 16 },
          },
        ],
      }),
    ).toThrow("strokeWidth requires stroke");
  });

  it("preserves independent fill and stroke opacity", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "rect-opacity",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle" },
          style: {
            fill: "#00aa88",
            fillOpacity: 0.5,
            stroke: "#ff3366",
            strokeOpacity: 0.25,
          },
        },
      ],
    });
    expect(buffer.commands).toContainEqual(
      expect.objectContaining({
        op: "drawShape",
        fillOpacity: 0.5,
        strokeOpacity: 0.25,
      }),
    );
  });

  it("rejects stroke opacity without a stroke color", () => {
    expect(() =>
      compileProtocolV2ToPaintCommands({
        ...base,
        layers: [
          {
            id: "invalid-stroke-opacity",
            type: "shape",
            parentLayerId: null,
            zIndex: 0,
            frame: { width: 80, height: 40 },
            transform: identity,
            opacity: 100,
            timing: { start: 0, duration: 1 },
            payload: { shape: "rectangle" },
            style: { fill: "#00aa88", strokeOpacity: 0.25 },
          },
        ],
      }),
    ).toThrow("strokeOpacity requires stroke");
  });

  it("lowers a rounded rectangle geometry and clamps its radius", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "rounded-rect",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle", cornerRadius: 30 },
          style: { fill: "#00aa88" },
        },
      ],
    });
    expect(buffer.commands).toContainEqual(
      expect.objectContaining({
        op: "drawShape",
        shape: "rectangle",
        cornerRadius: 20,
      }),
    );
  });

  it("rejects corner radius on an ellipse", () => {
    expect(() =>
      compileProtocolV2ToPaintCommands({
        ...base,
        layers: [
          {
            id: "invalid-rounded-ellipse",
            type: "shape",
            parentLayerId: null,
            zIndex: 0,
            frame: { width: 80, height: 40 },
            transform: identity,
            opacity: 100,
            timing: { start: 0, duration: 1 },
            payload: { shape: "ellipse", cornerRadius: 8 },
            style: { fill: "#00aa88" },
          },
        ],
      }),
    ).toThrow("cornerRadius requires rectangle");
  });

  it("lowers semantic gradient fill data without moving it into the renderer", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "gradient-rect",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 80, height: 40 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: { shape: "rectangle" },
          style: {
            fill: {
              type: "linear-gradient",
              angle: 0,
              stops: [
                { offset: 0, color: "#ff0000" },
                { offset: 1, color: "#0000ff" },
              ],
            },
          },
        },
      ],
    });
    expect(buffer.commands).toContainEqual(
      expect.objectContaining({
        op: "drawShape",
        fill: "#ff0000",
        fillPaint: {
          type: "linear-gradient",
          angle: 0,
          stops: [
            { offset: 0, color: "#ff0000" },
            { offset: 1, color: "#0000ff" },
          ],
        },
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

  it("applies the inverse camera transform in the locked order", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      composition: {
        ...base.composition,
        view: {
          projection: { kind: "perspective", fov: 60, near: 1, far: 4000 },
          transform: {
            translate: { x: 10, y: 20, z: 30 },
            rotate: { x: 10, y: 20, z: 30 },
          },
        },
      },
      layers: [],
    });
    const begin = buffer.commands[0];
    if (!begin || begin.op !== "beginFrame" || !begin.projection) {
      throw new Error("Missing compiled camera projection");
    }

    const expectedRotation = multiplyMatrix4(
      multiplyMatrix4(rotationMatrixX(-10), rotationMatrixY(-20)),
      rotationMatrixZ(-30),
    );
    const expectedView = multiplyMatrix4(
      translationMatrix3D(-10, -20, -30),
      expectedRotation,
    );
    expect(begin.projection.viewMatrix).toEqual(Array.from(expectedView));

    const point = { x: 120, y: 80, z: 40 };
    expect(transformPoint4(
      begin.projection.viewMatrix,
      point,
    )).toEqual(transformPoint4(expectedView, point));
    expect(begin.projection.viewProjectionMatrix).toEqual(
      Array.from(
        multiplyMatrix4(
          new Float64Array(begin.projection.projectionMatrix),
          expectedView,
        ),
      ),
    );
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
    expect(transform.matrix4[0]).toBeCloseTo(0, 8);
    expect(transform.matrix4[1]).toBeCloseTo(1, 8);
    expect(transform.matrix4[4]).toBeCloseTo(-1, 8);
    expect(transform.matrix4[5]).toBeCloseTo(1, 8);
    expect(transform.matrix4[12]).toBeCloseTo(30, 8);
    expect(transform.matrix4[13]).toBeCloseTo(-20, 8);
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

  it("rejects retired V1 envelopes before lowering", () => {
    expect(() =>
      compileProtocolV2({
        format: "motion-project",
        formatVersion: 1,
        id: "legacy",
        composition: base.composition,
        layers: [],
      }),
    ).toThrow();
  });

  it("rejects mixed V1/V2 fields instead of migrating them", () => {
    expect(() =>
      compileProtocolV2({
        ...base,
        bone: { id: "legacy-bone" },
        layers: [],
      }),
    ).toThrow();

    expect(() =>
      compileProtocolV2({
        ...base,
        layers: [
          {
            id: "mixed",
            type: "shape",
            parentLayerId: null,
            zIndex: 0,
            frame: { width: 40, height: 20 },
            transform: { ...identity, origin: { x: 0.5, y: 0.5 } },
            opacity: 100,
            timing: { start: 0, duration: 1 },
            payload: { shape: "rectangle" },
            style: { fill: "#00aa88" },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects unknown atom and transform fields fail-closed", () => {
    expect(() =>
      compileProtocolV2({
        ...base,
        layers: [
          {
            id: "unknown-shape",
            type: "shape",
            parentLayerId: null,
            zIndex: 0,
            frame: { width: 40, height: 20 },
            transform: identity,
            opacity: 100,
            timing: { start: 0, duration: 1 },
            payload: { shape: "polygon" },
            style: { fill: "#00aa88" },
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      compileProtocolV2({
        ...base,
        layers: [
          {
            id: "unknown-transform",
            type: "shape",
            parentLayerId: null,
            zIndex: 0,
            frame: { width: 40, height: 20 },
            transform: { ...identity, depth: 100 },
            opacity: 100,
            timing: { start: 0, duration: 1 },
            payload: { shape: "rectangle" },
            style: { fill: "#00aa88" },
          },
        ],
      }),
    ).toThrow();
  });
});
