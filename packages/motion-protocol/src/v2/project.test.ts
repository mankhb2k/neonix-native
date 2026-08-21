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

  it("accepts ordered color-adjust effects only on drawable leaves", () => {
    const withEffect = {
      ...RECTANGLE_PROJECT,
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        effects: [{
          id: "grade",
          type: "color-adjust" as const,
          brightness: -0.1,
          contrast: 1.2,
          saturation: 0.5,
          hueRotate: 30,
        }],
      }],
    };
    expect(MotionProtocolV2Schema.parse(withEffect)).toEqual(withEffect);
    expect(() => MotionProtocolV2Schema.parse({
      ...withEffect,
      layers: [{
        ...withEffect.layers[0],
        effects: [{ ...withEffect.layers[0].effects[0], brightness: 2 }],
      }],
    })).toThrow();
    expect(() => MotionProtocolV2Schema.parse({
      ...withEffect,
      layers: [{
        ...withEffect.layers[0],
        effects: [
          withEffect.layers[0].effects[0],
          { ...withEffect.layers[0].effects[0] },
        ],
      }],
    })).toThrow(/Duplicate effect id/);
  });

  it("accepts blur with a positive bounded radius", () => {
    const blur = {
      ...RECTANGLE_PROJECT,
      layers: [{
        ...RECTANGLE_PROJECT.layers[0],
        effects: [{ id: "soften", type: "blur" as const, radius: 18 }],
      }],
    };
    expect(MotionProtocolV2Schema.parse(blur)).toEqual(blur);
    expect(() => MotionProtocolV2Schema.parse({
      ...blur,
      layers: [{ ...blur.layers[0], effects: [{ id: "soften", type: "blur", radius: 0 }] }],
    })).toThrow();
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

  it("accepts an image asset reference with fit and normalized crop", () => {
    const image = {
      ...RECTANGLE_PROJECT,
      id: "image-project-v2",
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
        transform: RECTANGLE_PROJECT.layers[0].transform,
        opacity: 100,
        timing: { start: 0, duration: 1 },
        payload: {
          assetId: "photo",
          fit: "cover" as const,
          crop: { x: 0.25, y: 0, width: 0.5, height: 1 },
        },
      }],
    };
    expect(MotionProtocolV2Schema.parse(image)).toEqual(image);
    expect(() => MotionProtocolV2Schema.parse({
      ...image,
      layers: [{ ...image.layers[0], payload: { assetId: "photo", crop: { x: 0.75, y: 0, width: 0.5, height: 1 } } }],
    })).toThrow(/crop x \+ width/);
  });

  it("accepts a video asset with trim, loop, mute, and frame policy", () => {
    const video = {
      ...RECTANGLE_PROJECT,
      id: "video-project-v2",
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
        transform: RECTANGLE_PROJECT.layers[0].transform,
        opacity: 100,
        timing: { start: 0, duration: 3 },
        payload: {
          assetId: "clip",
          fit: "cover" as const,
          trimStart: 1,
          trimEnd: 4,
          loop: true,
          muted: true,
          framePolicy: "floor" as const,
        },
      }],
    };
    expect(MotionProtocolV2Schema.parse(video)).toEqual(video);
    expect(() => MotionProtocolV2Schema.parse({
      ...video,
      layers: [{ ...video.layers[0], payload: { ...video.layers[0].payload, trimStart: 4, trimEnd: 1 } }],
    })).toThrow(/trimEnd must be greater/);
  });

  it("accepts text only with an exact font asset and the locked MVP layout", () => {
    const text = {
      ...RECTANGLE_PROJECT,
      id: "text-project-v2",
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
        transform: RECTANGLE_PROJECT.layers[0].transform,
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
    };
    expect(MotionProtocolV2Schema.parse(text)).toEqual(text);
    expect(() => MotionProtocolV2Schema.parse({
      ...text,
      layers: [{ ...text.layers[0], payload: { ...text.layers[0].payload, fontAssetId: "missing" } }],
    })).toThrow(/Unknown font asset/);
    expect(() => MotionProtocolV2Schema.parse({
      ...text,
      assets: [{ ...text.assets[0], kind: "image" as const, width: 10, height: 10 }],
    })).toThrow(/Text layer must reference a font asset/);
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
    expect(isV2AtomCertified("image.asset")).toBe(true);
    expect(isV2AtomCertified("image.fit")).toBe(true);
    expect(isV2AtomCertified("image.crop")).toBe(true);
    expect(isV2AtomCertified("effect.color-adjust")).toBe(true);
    expect(isV2AtomCertified("shape.path.fill")).toBe(false);
  });
});
