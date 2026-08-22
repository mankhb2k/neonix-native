import { describe, expect, it } from "vitest";
import {
  multiplyMatrix4,
  perspectiveProjectionMatrix,
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
    view: {
      projection: { kind: "orthographic" as const, zoom: 1, near: 1, far: 4000 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        rotate: { x: 0, y: 0, z: 0 },
      },
    },
  },
};

describe("Protocol V2 Compiler B", () => {
  it("lowers the Text atom without shaping or font I/O", () => {
    const runtime = compileProtocolV2({
      ...base,
      id: "v2-text",
      assets: [{
        id: "roboto-regular",
        kind: "font" as const,
        uri: "/fonts/Roboto-Regular.ttf",
        mimeType: "font/ttf" as const,
        family: "Roboto",
        weight: 400,
        style: "normal" as const,
        integrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459",
      }],
      layers: [{
        id: "headline",
        type: "text" as const,
        parentLayerId: null,
        zIndex: 0,
        frame: { width: 320, height: 100 },
        transform: identity,
        opacity: 100,
        timing: { start: 0, duration: 1 },
        payload: {
          text: "NeonVideo",
          fontAssetId: "roboto-regular",
          fontSize: 48,
          lineHeight: 56,
          letterSpacing: 0,
          align: "center" as const,
          verticalAlign: "middle" as const,
          wrap: "none" as const,
          overflow: "visible" as const,
          direction: "ltr" as const,
          language: "en",
        },
        style: { fill: "#ffffff" },
      }],
    });
    expect(runtime.nodes[0]?.content).toMatchObject({
      kind: "text",
      fontUri: "/fonts/Roboto-Regular.ttf",
      align: "center",
      verticalAlign: "middle",
    });
    expect(runtime.nodes[0]?.content.kind === "text" && runtime.nodes[0].content.layout).toBeUndefined();
  });

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
    expect(runtime.view.worldToClipMatrix).toHaveLength(16);
  });

  it("preserves ordered color-adjust effects from Protocol V2 through the layer effect program", () => {
    const project = {
      ...base,
      id: "v2-color-adjust",
      layers: [{
        id: "graded-rectangle",
        type: "shape" as const,
        parentLayerId: null,
        zIndex: 0,
        frame: { width: 80, height: 40 },
        transform: identity,
        opacity: 100,
        timing: { start: 0, duration: 1 },
        effects: [
          {
            id: "first",
            type: "color-adjust" as const,
            brightness: -0.1,
            contrast: 1.2,
            saturation: 0.8,
            hueRotate: 15,
          },
          {
            id: "second",
            type: "color-adjust" as const,
            brightness: 0.05,
            contrast: 0.9,
            saturation: 1.1,
            hueRotate: -5,
          },
        ],
        payload: { shape: "rectangle" as const },
        style: { fill: "#ff0000" },
      }],
    };
    const runtime = compileProtocolV2(project);
    expect(runtime.nodes[0]?.content).toMatchObject({
      kind: "shape",
      effects: project.layers[0].effects,
    });
    const commands = compileProtocolV2ToPaintCommands(project).commands;
    const scope = commands.find((command) => command.op === "beginLayer");
    expect(scope).toMatchObject({
      effectProgram: {
        ops: project.layers[0].effects.map((effect) => expect.objectContaining({ id: effect.id })),
      },
    });
    const draw = commands.find((command) => command.op === "drawShape");
    expect(draw).not.toHaveProperty("effects");
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

  it("lowers an Image Atom to a backend-neutral drawImage command", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      assets: [{
        id: "photo",
        kind: "image" as const,
        uri: "/docs/preview-image.svg",
        mimeType: "image/svg+xml",
        width: 200,
        height: 100,
      }],
      layers: [{
        id: "image",
        type: "image" as const,
        parentLayerId: null,
        zIndex: 0,
        frame: { width: 320, height: 240 },
        transform: { ...identity, translate: { x: 20, y: 30, z: 0 } },
        opacity: 100,
        timing: { start: 0, duration: 1 },
        payload: {
          assetId: "photo",
          fit: "cover" as const,
          crop: { x: 0.25, y: 0, width: 0.5, height: 1 },
        },
      }],
    });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "drawImage",
      key: "image",
      assetId: "photo",
      uri: "/docs/preview-image.svg",
      width: 320,
      height: 240,
      fit: "cover",
      crop: { x: 0.25, y: 0, width: 0.5, height: 1 },
    }));
  });

  it("lowers a Video Atom with source timing policy to drawVideo", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      assets: [{
        id: "clip",
        kind: "video" as const,
        uri: "/docs/example-video.mp4",
        mimeType: "video/mp4",
        width: 1920,
        height: 1080,
        duration: 60.5,
        fps: 30,
      }],
      layers: [{
        id: "video",
        type: "video" as const,
        parentLayerId: null,
        zIndex: 0,
        frame: { width: 960, height: 540 },
        transform: identity,
        opacity: 100,
        timing: { start: 0, duration: 3 },
        payload: {
          assetId: "clip",
          fit: "cover" as const,
          trimStart: 1,
          trimEnd: 4,
          loop: true,
          muted: true,
          framePolicy: "round" as const,
        },
      }],
    });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "drawVideo",
      key: "video",
      assetId: "clip",
      uri: "/docs/example-video.mp4",
      width: 960,
      height: 540,
      fit: "cover",
      mediaTime: 1,
      mediaVisible: true,
      muted: true,
    }));
  });

  it("lowers a filled local-plane path into one resolved mesh command", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "triangle",
          type: "path",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 220, height: 180 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: {
            fillRule: "nonzero",
            contours: [{
              id: "triangle-contour",
              start: { x: 20, y: 10 },
              segments: [
                { kind: "line", to: { x: 180, y: 40 } },
                { kind: "line", to: { x: 70, y: 150 } },
                { kind: "line", to: { x: 20, y: 10 } },
              ],
              closed: true,
            }],
          },
          style: { fill: "#00aa88" },
        },
      ],
    });

    expect(buffer.commands).toContainEqual(
      expect.objectContaining({
        op: "drawPath",
        key: "triangle",
        fill: "#00aa88",
        fillRule: "nonzero",
        mesh: expect.objectContaining({
          vertices: expect.any(Array),
          indices: expect.any(Array),
          bounds: { x: 20, y: 10, width: 160, height: 140 },
        }),
      }),
    );
  });

  it("lowers a certified path stroke into a separate resolved stroke mesh", () => {
    const buffer = compileProtocolV2ToPaintCommands({
      ...base,
      layers: [
        {
          id: "triangle-stroke",
          type: "path",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 220, height: 180 },
          transform: identity,
          opacity: 100,
          timing: { start: 0, duration: 1 },
          payload: {
            fillRule: "nonzero",
            contours: [{
              id: "triangle-contour",
              start: { x: 20, y: 10 },
              segments: [
                { kind: "line", to: { x: 180, y: 40 } },
                { kind: "line", to: { x: 70, y: 150 } },
                { kind: "line", to: { x: 20, y: 10 } },
              ],
              closed: true,
            }],
          },
          style: { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 12, strokeOpacity: 0.75 },
        },
      ],
    });

    expect(buffer.commands).toContainEqual(
      expect.objectContaining({
        op: "drawPath",
        stroke: "#ff3366",
        strokeWidth: 12,
        strokeOpacity: 0.75,
        strokeMesh: expect.objectContaining({
          vertices: expect.any(Array),
          indices: expect.any(Array),
        }),
      }),
    );
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
    expect(begin.projection.worldToClipMatrix).toHaveLength(16);
    expect(begin.projection.worldToClipMatrix[11]).toBe(-1);
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
    const expectedProjection = perspectiveProjectionMatrix(320, 180, 60, 1, 4000);
    const point = { x: 120, y: 80, z: 40 };
    expect(transformPoint4(
      expectedView,
      point,
    )).toEqual(transformPoint4(expectedView, point));
    expect(begin.projection.worldToClipMatrix).toEqual(
      Array.from(
        multiplyMatrix4(
          expectedProjection,
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

  it("lowers group transforms, opacity, and nested timing into the child leaf", () => {
    const buffer = compileProtocolV2ToPaintCommands(
      {
        ...base,
        layers: [
          {
            id: "group",
            type: "group" as const,
            parentLayerId: null,
            zIndex: 0,
            frame: { width: 200, height: 120 },
            transform: {
              ...identity,
              translate: { x: 100, y: 50, z: 30 },
            },
            opacity: 50,
            timing: { start: 0.5, duration: 2 },
          },
          {
            id: "child",
            type: "shape" as const,
            parentLayerId: "group",
            zIndex: 1,
            frame: { width: 80, height: 40 },
            transform: {
              ...identity,
              translate: { x: 20, y: 10, z: 5 },
            },
            opacity: 80,
            timing: { start: 0.25, duration: 1.5 },
            payload: { shape: "rectangle" as const },
            style: { fill: "#00aa88" },
          },
        ],
      },
      { time: 0.75 },
    );
    const transforms = buffer.commands.filter((command) => command.op === "setTransform");
    expect(transforms).toHaveLength(1);
    expect(transforms[0]).toMatchObject({
      key: "child",
      alpha: 0.4,
      zIndex: 1,
    });
    if (transforms[0]?.op !== "setTransform") throw new Error("Missing child transform");
    expect(transforms[0].matrix4[12]).toBeCloseTo(120, 8);
    expect(transforms[0].matrix4[13]).toBeCloseTo(60, 8);
    expect(transforms[0].matrix4[14]).toBeCloseTo(35, 8);
    expect(buffer.commands.some((command) => command.op === "drawShape" && command.key === "group")).toBe(false);

    expect(
      compileProtocolV2ToPaintCommands(
        {
          ...base,
          layers: [
            {
              id: "group",
              type: "group" as const,
              parentLayerId: null,
              zIndex: 0,
              frame: { width: 200, height: 120 },
              transform: identity,
              opacity: 50,
              timing: { start: 0.5, duration: 2 },
            },
            {
              id: "child",
              type: "shape" as const,
              parentLayerId: "group",
              zIndex: 1,
              frame: { width: 80, height: 40 },
              transform: identity,
              opacity: 80,
              timing: { start: 0.25, duration: 1.5 },
              payload: { shape: "rectangle" as const },
              style: { fill: "#00aa88" },
            },
          ],
        },
        { time: 0.749 },
      ).commands.map((command) => command.op),
    ).toEqual(["beginFrame", "endFrame"]);
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
