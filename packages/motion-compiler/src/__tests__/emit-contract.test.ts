/**
 * Compiler emit contract: V1 authoring → Runtime IR without legacy language.
 */
import { describe, expect, it } from "vitest";
import {
  isLayerPropertyAnimatable,
  V1,
  visualLayerAtoms,
} from "@motionvideo/motion-protocol";
import { compileMotionProjectV1 } from "../index";

const atoms = visualLayerAtoms({
  width: 200,
  height: 120,
  x: 0,
  y: 0,
});

function baseProject(overrides: Record<string, unknown> = {}): V1.MotionProjectV1 {
  return V1.MotionProjectV1Schema.parse({
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "emit-contract", name: "Emit contract", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [],
    assets: [],
    components: [],
    timeline: { duration: 4 },
    bindings: [],
    layers: [],
    ...overrides,
  });
}

const png = {
  id: "img-1",
  uri: "./a.png",
  integrity: "sha256:img",
  assetType: "image" as const,
  mimeType: "image/png",
  width: 64,
  height: 64,
  pixelFormat: "rgba",
  hasAlpha: true,
};

const svgAsset = {
  id: "svg-1",
  uri: "./a.svg",
  integrity: "sha256:svg",
  assetType: "svg" as const,
  mimeType: "image/svg+xml",
  width: 64,
  height: 64,
  viewBox: "0 0 64 64",
  sanitized: true,
};

const videoAsset = {
  id: "vid-1",
  uri: "./a.mp4",
  integrity: "sha256:vid",
  assetType: "video" as const,
  mimeType: "video/mp4",
  width: 1920,
  height: 1080,
  duration: 10,
  fps: 30,
};

const contour = {
  id: "c1",
  closed: true,
  start: { x: 0, y: 0 },
  segments: [{ kind: "line" as const, to: { x: 100, y: 0 } }],
};

describe("compiler V1 emit contract", () => {
  it("emits text payload.color and derived style.fill, never modifiers", () => {
    const project = baseProject({
      layers: [
        {
          id: "title",
          type: "text",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 4 },
          ...atoms,
          payload: { text: "Hello", fontSize: 48, color: "#112233" },
        },
      ],
    });
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const layer = result.project.layers.find((item) => item.id === "title");
    expect(layer?.type).toBe("text");
    expect(layer && "payload" in layer ? layer.payload : undefined).toMatchObject({
      text: "Hello",
      color: "#112233",
    });
    expect(layer && "style" in layer ? layer.style : undefined).toEqual({
      fill: "#112233",
    });
    expect(result.project.layers.every((item) => !("modifiers" in item))).toBe(
      true,
    );
  });

  it("emits shape/path style paint, not payload.color; preserves evenodd", () => {
    const project = baseProject({
      layers: [
        {
          id: "rect",
          type: "shape",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 4 },
          ...atoms,
          payload: { shape: "rectangle" },
          style: { fill: "#ff0000" },
        },
        {
          id: "p",
          type: "path",
          parentLayerId: null,
          zIndex: 1,
          timing: { start: 0, duration: 4 },
          ...atoms,
          payload: { contours: [contour], fillRule: "evenodd" },
          style: { fill: "#00ff00" },
        },
      ],
    });
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const shape = result.project.layers.find((item) => item.id === "rect");
    const path = result.project.layers.find((item) => item.id === "p");
    expect(shape && "payload" in shape ? shape.payload : {}).not.toHaveProperty(
      "color",
    );
    expect(path && "payload" in path ? path.payload : {}).toMatchObject({
      fillRule: "evenodd",
    });
    expect(path && "payload" in path ? path.payload : {}).not.toHaveProperty(
      "color",
    );
  });

  it("emits image/svg/video defaults and no forbidden style/color", () => {
    const project = baseProject({
      assets: [png, svgAsset, videoAsset],
      layers: [
        {
          id: "im",
          type: "image",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 4 },
          ...atoms,
          payload: { assetId: "img-1" },
        },
        {
          id: "sv",
          type: "svg",
          parentLayerId: null,
          zIndex: 1,
          timing: { start: 0, duration: 4 },
          ...atoms,
          payload: { assetId: "svg-1" },
        },
        {
          id: "vd",
          type: "video",
          parentLayerId: null,
          zIndex: 2,
          timing: { start: 0, duration: 4 },
          ...atoms,
          payload: { assetId: "vid-1" },
        },
      ],
    });
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const image = result.project.layers.find((item) => item.id === "im");
    const svg = result.project.layers.find((item) => item.id === "sv");
    const video = result.project.layers.find((item) => item.id === "vd");
    expect(image && "payload" in image ? image.payload : {}).toMatchObject({
      assetId: "img-1",
      fit: "cover",
    });
    expect(image).not.toHaveProperty("style");
    expect(svg && "payload" in svg ? svg.payload : {}).toMatchObject({
      assetId: "svg-1",
      fit: "contain",
    });
    expect(video && "payload" in video ? video.payload : {}).toMatchObject({
      assetId: "vid-1",
      fit: "cover",
      loop: false,
      muted: false,
    });
    expect(video).not.toHaveProperty("style");
  });

  it("compiles timeline.clips to tracks and ignores AI motionUnits", () => {
    const project = baseProject({
      extensions: {
        "com.moticlip.ai": {
          motionUnits: [
            {
              id: "legacy",
              layerId: "title",
              schedule: { kind: "absolute", at: 0 },
              duration: 1,
              playback: { rate: 1, iterations: 1, direction: "normal" },
              source: {
                kind: "tracks",
                tracks: [
                  {
                    layerId: "title",
                    property: "modifiers.mp.progress",
                    keys: [{ t: 0, v: 0 }],
                  },
                ],
              },
            },
          ],
        },
      },
      layers: [
        {
          id: "title",
          type: "text",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 4 },
          ...atoms,
          payload: { text: "Hi", fontSize: 24, color: "#000000" },
          effects: [{ id: "fx", type: "blur", radius: 4 }],
        },
      ],
      timeline: {
        duration: 4,
        clips: [
          {
            id: "op",
            layerId: "title",
            property: "appearance.opacity",
            kind: "keyframes",
            keys: [
              { t: 0, value: 0 },
              { t: 1, value: 100 },
            ],
          },
          {
            id: "blur",
            layerId: "title",
            property: "effects.fx.radius",
            kind: "keyframes",
            keys: [
              { t: 0, value: 0 },
              { t: 1, value: 8 },
            ],
          },
        ],
      },
    });
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.project.tracks.every(
        (track) => !track.property.startsWith("modifiers."),
      ),
    ).toBe(true);
    expect(
      result.project.tracks.map((track) => `${track.layerId}:${track.property}`),
    ).toEqual(["title:appearance.opacity", "title:effects.fx.radius"]);
    for (const track of result.project.tracks) {
      const layer = result.project.layers.find((item) => item.id === track.layerId);
      expect(layer).toBeDefined();
      if (!layer) continue;
      expect(isLayerPropertyAnimatable(layer.type, track.property)).toBe(true);
    }
  });

  it("expands component instances without emitting a component runtime type", () => {
    const project = baseProject({
      dependencies: {
        compiler: { range: ">=1.0.0" },
        components: [
          {
            componentId: "logo-reveal",
            version: "1.0.0",
            integrity: "sha256:logo-reveal-1.0.0",
          },
        ],
      },
      components: [
        {
          id: "logo-reveal",
          version: "1.0.0",
          integrity: "sha256:logo-reveal-1.0.0",
          props: [
            {
              id: "logo-color",
              name: "Logo Color",
              kind: "color",
              default: "#1877f2",
            },
          ],
          propBindings: [
            {
              propId: "logo-color",
              target: {
                kind: "layerProperty",
                layerId: "logo",
                property: "payload.color",
              },
            },
          ],
          layers: [
            {
              id: "logo",
              type: "solid",
              parentLayerId: null,
              zIndex: 0,
              timing: { start: 0, duration: 4 },
              ...visualLayerAtoms({ width: 64, height: 64 }),
              payload: { color: "#1877f2" },
            },
          ],
        },
      ],
      layers: [
        {
          id: "badge",
          type: "component",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 4 },
          ...visualLayerAtoms({ width: 64, height: 64 }),
          payload: {
            componentId: "logo-reveal",
            props: {
              "logo-color": "#ff0000",
            },
          },
        },
      ],
    });
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.layers.every((layer) => layer.type !== "component")).toBe(
      true,
    );
    expect(result.project.layers.some((layer) => layer.id.includes("badge"))).toBe(
      true,
    );
  });
});
