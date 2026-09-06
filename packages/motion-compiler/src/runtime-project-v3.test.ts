import { describe, expect, it } from "vitest";
import { V2_AUDIO_FIXTURES } from "@motionvideo/motion-protocol";
import type { V2Easing } from "@motionvideo/motion-protocol/v2";
import type { RuntimeMediaCatalogV3 } from "@motionvideo/motion-runtime";
import {
  compileProtocol,
  compileProtocolAtTime,
  compileProtocolToPaintCommands,
  COMPILER_SUPPORTED_FEATURES,
  isCompilerFeatureSupported,
} from "./index";
import { sampleMotionProtocolAtTime } from "./animation/sampler";

describe("canonical compiler V3 projection", () => {
  it("owns the feature support catalog", () => {
    expect(COMPILER_SUPPORTED_FEATURES).toContain("shape.rectangle.fill");
    expect(isCompilerFeatureSupported("shape.rectangle.fill")).toBe(true);
    expect(isCompilerFeatureSupported("shape.path.fill")).toBe(false);
  });

  it("derives RuntimeProjectV3 from the same canonical compiler output", () => {
    const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === "audio.mix.video-plus-music");
    if (!fixture) throw new Error("audio.mix.video-plus-music fixture is missing");

    const runtime = compileProtocol(fixture.project);

    expect(runtime).toMatchObject({
      format: "motion-runtime",
      runtimeVersion: 3,
      projectId: fixture.project.id,
      visual: {
        composition: expect.any(Object),
        view: expect.any(Object),
        nodes: expect.any(Array),
      },
    });
    const clips = runtime.audioTimeline.tracks.flatMap((track) => track.clips);
    expect(clips).toHaveLength(2);
    expect(clips.map((clip) => clip.timelineDurationSamples)).toEqual([480_000, 480_000]);
  });

  it("keeps catalog durationSamples in the native 44.1 kHz source domain", () => {
    const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === "audio.timing");
    if (!fixture) throw new Error("audio.timing fixture is missing");

    const runtime = compileProtocol(fixture.project);
    const stream = runtime.mediaCatalog.assets[0]?.audio?.[0];

    expect(stream).toMatchObject({
      sampleRate: 44_100,
      durationSamples: Math.round(124.551837 * 44_100),
    });
  });

  it("uses probe-hydrated media metadata when a catalog is supplied", () => {
    const catalog: RuntimeMediaCatalogV3 = {
      assets: [{
        mediaId: "music-mbb-island-tropical",
        audio: [{
          streamId: "probe:music:0",
          resource: {
            resourceId: "music-derivative-v2",
            role: "audio-proxy",
            uri: "/derivatives/music.m4a",
          },
          durationSamples: 5_492_736,
          sampleRate: 44_100,
          channels: 2,
        }],
      }],
    };

    const runtime = compileProtocol(fixtureProject("audio.timing"), { mediaCatalog: catalog });
    expect(runtime.mediaCatalog).toBe(catalog);
    expect(runtime.audioTimeline.tracks[0]?.clips[0]?.source).toEqual({
      mediaId: "music-mbb-island-tropical",
      streamId: "probe:music:0",
    });
  });

  it("is deterministic and rejects a probe catalog without a required derivative", () => {
    const project = fixtureProject("audio.timing");
    expect(compileProtocol(project)).toEqual(compileProtocol(project));
    try {
      compileProtocol(project, { mediaCatalog: { assets: [] } });
      throw new Error("Expected compilation to reject the missing derivative");
    } catch (error) {
      expect(error).toMatchObject({ code: "MISSING_AUDIO_DERIVATIVE" });
    }
  });

  it("lowers SVG filter graph primitives to the runtime effect program", () => {
    const project = filterProject({
      id: "outer-glow",
      primitives: [
        { id: "blur", type: "feGaussianBlur", in: "SourceAlpha", stdDeviation: { x: 12, y: 12 }, result: "blurred" },
        { id: "color", type: "feFlood", color: "#00e5ff", opacity: 0.75, result: "color" },
        { id: "composite", type: "feComposite", in: "color", in2: "blurred", operator: "in", result: "glow" },
        { id: "merge", type: "feMerge", nodes: [{ in: "glow" }, { in: "SourceGraphic" }] },
      ],
    });
    const buffer = compileProtocolToPaintCommands(project);
    const beginLayer = buffer.commands.find((command) => command.op === "beginLayer");
    expect(beginLayer).toMatchObject({
      effectProgram: {
        ops: [
          { kind: "alpha-mask" },
          { kind: "blur" },
          { kind: "tint" },
          { kind: "composite" },
        ],
      },
    });
  });

  it("preserves SVG linearRGB for color-matrix operations", () => {
    const project = filterProject({
      id: "hue-rotate",
      primitives: [
        { id: "hue", type: "feColorMatrix", in: "SourceGraphic", kind: "hueRotate", values: [120] },
      ],
    });
    const buffer = compileProtocolToPaintCommands(project);
    const beginLayer = buffer.commands.find((command) => command.op === "beginLayer");
    expect(beginLayer).toMatchObject({
      effectProgram: { ops: [{ kind: "color-adjust", hueRotate: 120, colorInterpolationFilters: "linearRGB" }] },
    });
  });

  it("preserves SVG vector-effect when lowering a path", () => {
    const project = filterProject({ id: "vector-effect", primitives: [] });
    project.filters = [];
    project.layers[0] = {
      ...project.layers[0]!,
      filter: undefined,
      style: { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 12, vectorEffect: "non-scaling-stroke" },
    };
    const buffer = compileProtocolToPaintCommands(project);
    const path = buffer.commands.find((command) => command.op === "drawPath");
    expect(path).toMatchObject({ vectorEffect: "non-scaling-stroke" });
  });

  it("keeps composition perspective and layer z in the canonical Runtime Matrix4", () => {
    const project = filterProject({ id: "perspective-layer", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    project.composition.view.projection = {
      kind: "perspective",
      fov: 60,
      near: 1,
      far: 4000,
    };
    project.layers[0].transform.translate.z = 120;
    project.layers[0].transform.rotate.y = 18;

    const runtime = compileProtocol(project);
    const node = runtime.visual.nodes.find((candidate) => candidate.id === "filtered-path");
    expect(runtime.visual.view.worldToClipMatrix[11]).not.toBe(0);
    expect(runtime.visual.view.depthClip).toBe("global");
    expect(node?.localMatrix).toHaveLength(16);
    expect(node?.worldMatrix[14]).toBeCloseTo(120, 8);
    expect(node?.worldMatrix[2]).not.toBeCloseTo(0, 8);
  });

  it("applies group perspective-origin to descendants without changing their authored local matrix", () => {
    const project = filterProject({ id: "perspective-group", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    const group = {
      type: "group",
      id: "perspective-group-layer",
      parentLayerId: null,
      order: 0,
      frame: { width: 960, height: 540 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3000 },
      render3d: {
        transformStyle: "preserve-3d",
        perspective: { distance: 800, origin: { x: 480, y: 270 } },
      },
    };
    project.layers[0] = {
      ...project.layers[0],
      parentLayerId: group.id,
      order: 0,
      transform: {
        ...project.layers[0].transform,
        translate: { x: 100, y: 0, z: 120 },
      },
    };
    project.layers.unshift(group);

    const runtime = compileProtocol(project);
    const node = runtime.visual.nodes.find((candidate) => candidate.id === "filtered-path");
    expect(runtime.visual.view.depthClip).toBe("w-only");
    expect(node?.localMatrix[14]).toBeCloseTo(120, 8);
    expect(node?.worldMatrix[11]).toBeCloseTo(-1 / 800, 12);
    // Homogeneous translation stores the pre-divide numerator. The x=100
    // authored position is projected around origin.x=480 at z=120:
    // 100 - 480 * (120 / 800) = 28, then divided by w=0.85.
    expect(node?.worldMatrix[12]).toBeCloseTo(28, 8);
  });

  it("samples perspective distance and origin tracks before rebuilding the Matrix4 chain", () => {
    const project = filterProject({ id: "animated-perspective", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    const group = {
      type: "group",
      id: "animated-perspective-group",
      parentLayerId: null,
      order: 0,
      frame: { width: 800, height: 500 },
      transform: { translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 1000 },
      render3d: { transformStyle: "preserve-3d", perspective: { distance: 400, origin: { x: 80, y: 100 } } },
      tracks: [
        {
          id: "camera-distance",
          path: "render3d.perspective.distance",
          keyframes: [{ time: 0, value: { type: "number", value: 400 } }, { time: 1000, value: { type: "number", value: 900 } }],
          playback: { durationMs: 1000, delayMs: 0, iterations: 1, direction: "normal", fillMode: "both", playState: "running" },
        },
        {
          id: "camera-origin",
          path: "render3d.perspective.origin",
          keyframes: [{ time: 0, value: { type: "vec2", value: [80, 100] } }, { time: 1000, value: { type: "vec2", value: [800, 500] } }],
          playback: { durationMs: 1000, delayMs: 0, iterations: 1, direction: "normal", fillMode: "both", playState: "running" },
        },
      ],
    };
    project.layers[0] = {
      ...project.layers[0],
      parentLayerId: group.id,
      transform: { ...project.layers[0].transform, translate: { x: 120, y: 90, z: 140 } },
    };
    project.layers.unshift(group);

    const sampled = sampleMotionProtocolAtTime(project, 0.5);
    expect(sampled.layers[0]?.render3d?.perspective).toEqual({ distance: 650, origin: { x: 440, y: 300 } });
    const start = compileProtocolAtTime(project, 0);
    const middle = compileProtocolAtTime(project, 0.5);
    const startNode = start.visual.nodes.find((node) => node.id === "filtered-path");
    const middleNode = middle.visual.nodes.find((node) => node.id === "filtered-path");
    expect(startNode?.localMatrix[14]).toBeCloseTo(140, 8);
    expect(middleNode?.localMatrix[14]).toBeCloseTo(140, 8);
    expect(startNode?.worldMatrix[11]).not.toBeCloseTo(middleNode?.worldMatrix[11] ?? 0, 12);
    expect(startNode?.worldMatrix[12]).not.toBeCloseTo(middleNode?.worldMatrix[12] ?? 0, 8);
  });

  it("composes nested group perspectives in stable ancestor-to-descendant order", () => {
    const project = filterProject({ id: "nested-perspective", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    const outer = {
      type: "group",
      id: "outer-perspective",
      parentLayerId: null,
      order: 0,
      frame: { width: 960, height: 540 },
      transform: { translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3000 },
      render3d: { transformStyle: "preserve-3d", perspective: { distance: 900, origin: { x: 480, y: 270 } } },
    };
    const inner = {
      ...outer,
      id: "inner-perspective",
      parentLayerId: outer.id,
      render3d: { transformStyle: "preserve-3d", perspective: { distance: 420, origin: { x: 220, y: 140 } } },
    };
    project.layers[0] = {
      ...project.layers[0],
      parentLayerId: inner.id,
      transform: { ...project.layers[0].transform, translate: { x: 100, y: 0, z: 140 } },
    };
    project.layers.unshift(inner, outer);

    const runtime = compileProtocol(project);
    const node = runtime.visual.nodes.find((candidate) => candidate.id === "filtered-path");
    expect(runtime.visual.view.depthClip).toBe("w-only");
    expect(node?.worldMatrix[11]).toBeCloseTo(-1 / 900 - 1 / 420, 12);
    expect(node?.worldMatrix[14]).toBeCloseTo(140, 8);
  });

  it("flattens descendants at a CSS flat boundary while keeping the element paint projective", () => {
    const project = filterProject({ id: "flat-boundary", primitives: [] }) as any;
    project.filters = [];
    const base = project.layers[0];
    const outer = {
      type: "group",
      id: "flat-outer",
      parentLayerId: null,
      order: 0,
      frame: { width: 960, height: 540 },
      transform: { translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3000 },
      render3d: { transformStyle: "preserve-3d", perspective: { distance: 760, origin: { x: 480, y: 270 } } },
    };
    const flat = {
      ...outer,
      id: "flat-inner",
      parentLayerId: outer.id,
      render3d: { transformStyle: "flat", perspective: { distance: 400, origin: { x: 280, y: 325 } },
      },
    };
    const card = {
      id: "flat-card",
      type: "group",
      parentLayerId: flat.id,
      order: 0,
      frame: { width: 300, height: 240 },
      transform: { ...base.transform, translate: { x: 240, y: 120, z: 150 }, rotate: { x: 0, y: -26, z: 0 } },
      opacity: 1,
      timing: { start: 0, duration: 3000 },
    };
    const paint = {
      ...base,
      id: "flat-card::paint",
      parentLayerId: card.id,
      order: 0,
      filter: undefined,
      transform: { ...base.transform, translate: { x: 0, y: 0, z: 0 } },
    };
    const face = {
      ...base,
      id: "flat-face",
      parentLayerId: card.id,
      order: 1,
      filter: undefined,
      transform: { ...base.transform, translate: { x: 50, y: 45, z: 120 }, rotate: { x: 26, y: 0, z: 0 } },
    };
    project.layers = [outer, flat, card, paint, face];

    const runtime = compileProtocol(project);
    const cardPaint = runtime.visual.nodes.find((node) => node.id === paint.id);
    const childFace = runtime.visual.nodes.find((node) => node.id === face.id);
    expect(cardPaint?.worldMatrix[11]).not.toBeCloseTo(0, 12);
    // The ancestor's perspective remains active; the inner flat group's
    // projective terms are baked into the descendant geometry instead.
    expect(childFace?.worldMatrix[11]).toBeCloseTo(-1 / 760, 12);
  });

  it("samples protocol tracks before visual lowering", () => {
    const project = filterProject({ id: "animated", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    project.layers[0].tracks = [{
      id: "fade",
      path: "opacity",
      keyframes: [
        { time: 0, value: { type: "number", value: 0 } },
        { time: 1000, value: { type: "number", value: 1 } },
      ],
      playback: { durationMs: 1000, delayMs: 0, iterations: 2, direction: "alternate", fillMode: "both", playState: "running" },
    }];
    const runtime = compileProtocolAtTime(project, 0.5);
    expect(runtime.visual.nodes.find((node) => node.id === "filtered-path")?.opacity).toBeCloseTo(0.5);
  });

  it("culls a reversed layer when backface-visibility is hidden", () => {
    const project = filterProject({ id: "backface", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    project.layers[0].backfaceVisibility = "hidden";
    project.layers[0].transform.operations = [{ type: "extension", name: "motion.rotateY", value: 180 }];
    const runtime = compileProtocol(project);
    const node = runtime.visual.nodes.find((candidate) => candidate.id === "filtered-path");
    expect(node?.visible).toBe(false);
  });

  it("samples layer-owned motion path distance into a tangent-aligned runtime matrix", () => {
    const project = filterProject({ id: "motion-path", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    project.layers[0].motion = {
      offsetPath: {
        type: "path",
        contours: [{ id: "motion", start: { x: 100, y: 100 }, segments: [{ kind: "line", to: { x: 500, y: 100 } }], closed: false }],
        coordinateSpace: "parent-local",
        referenceBox: "border-box",
      },
      offsetDistance: 0,
      offsetRotate: { mode: "auto", angle: 0 },
      offsetAnchor: { x: 0, y: 0 },
    };
    project.layers[0].tracks = [{
      id: "motion-distance",
      path: "motion.offsetDistance",
      keyframes: [
        { time: 0, value: { type: "number", value: 0 } },
        { time: 1000, value: { type: "number", value: 1 } },
      ],
      playback: { durationMs: 1000, delayMs: 0, iterations: 1, direction: "normal", fillMode: "both", playState: "running" },
    }];
    const runtime = compileProtocolAtTime(project, 0.5);
    const node = runtime.visual.nodes.find((candidate) => candidate.id === "filtered-path");
    expect(node?.worldMatrix[12]).toBeCloseTo(300);
    expect(node?.worldMatrix[13]).toBeCloseTo(100);
  });

  it("applies delay and fill-mode without changing the underlying layer when inactive", () => {
    const sampleOpacity = (playback: Record<string, unknown>, time: number) => {
      const project = filterProject({ id: "animation-state", primitives: [] }) as any;
      project.filters = [];
      project.layers[0].filter = undefined;
      project.layers[0].opacity = 0.4;
      project.layers[0].tracks = [{
        id: "state-opacity",
        path: "opacity",
        keyframes: [
          { time: 0, value: { type: "number", value: 0.1 } },
          { time: 700, value: { type: "number", value: 0.9 } },
        ],
        playback,
      }];
      return sampleMotionProtocolAtTime(project, time).layers[0]?.opacity;
    };

    expect(sampleOpacity({ durationMs: 700, delayMs: 300, iterations: 1, direction: "normal", fillMode: "none", playState: "running" }, 0.2)).toBe(0.4);
    expect(sampleOpacity({ durationMs: 700, delayMs: 300, iterations: 1, direction: "normal", fillMode: "backwards", playState: "running" }, 0.2)).toBe(0.1);
    expect(sampleOpacity({ durationMs: 700, delayMs: 300, iterations: 1, direction: "normal", fillMode: "none", playState: "running" }, 1.1)).toBe(0.4);
    expect(sampleOpacity({ durationMs: 700, delayMs: 300, iterations: 1, direction: "normal", fillMode: "forwards", playState: "running" }, 1.0)).toBeCloseTo(0.9);
    expect(sampleOpacity({ durationMs: 700, delayMs: 300, iterations: 1, direction: "normal", fillMode: "both", playState: "running" }, 1.1)).toBeCloseTo(0.9);
    expect(sampleOpacity({ durationMs: 700, delayMs: -350, iterations: 1, direction: "normal", fillMode: "both", playState: "running" }, 0)).toBeCloseTo(0.5);
    expect(sampleOpacity({ durationMs: 700, delayMs: 0, iterations: 1, direction: "normal", fillMode: "both", playState: "paused" }, 0.5)).toBeCloseTo(0.6714285714);
  });

  it("samples direction at iteration boundaries and preserves fractional endpoints", () => {
    const sampleOpacity = (playback: Record<string, unknown>, time: number) => {
      const project = filterProject({ id: "iteration-state", primitives: [] }) as any;
      project.filters = [];
      project.layers[0].filter = undefined;
      project.layers[0].tracks = [{
        id: "iteration-opacity",
        path: "opacity",
        keyframes: [
          { time: 0, value: { type: "number", value: 0 } },
          { time: 1000, value: { type: "number", value: 1 } },
        ],
        playback,
      }];
      return sampleMotionProtocolAtTime(project, time).layers[0]?.opacity;
    };

    expect(sampleOpacity({ durationMs: 1000, delayMs: 0, iterations: 2, direction: "normal", fillMode: "both", playState: "running" }, 1.25)).toBeCloseTo(0.25);
    expect(sampleOpacity({ durationMs: 1000, delayMs: 0, iterations: 2, direction: "reverse", fillMode: "both", playState: "running" }, 0.25)).toBeCloseTo(0.75);
    expect(sampleOpacity({ durationMs: 1000, delayMs: 0, iterations: 2, direction: "alternate", fillMode: "both", playState: "running" }, 1.25)).toBeCloseTo(0.75);
    expect(sampleOpacity({ durationMs: 1000, delayMs: 0, iterations: 2, direction: "alternate-reverse", fillMode: "both", playState: "running" }, 1.25)).toBeCloseTo(0.25);
    expect(sampleOpacity({ durationMs: 1000, delayMs: 0, iterations: 2.5, direction: "normal", fillMode: "forwards", playState: "running" }, 2.5)).toBeCloseTo(0.5);
    expect(sampleOpacity({ durationMs: 1000, delayMs: 0, iterations: 2.5, direction: "alternate", fillMode: "forwards", playState: "running" }, 2.5)).toBeCloseTo(0.5);
    expect(sampleOpacity({ durationMs: 1000, delayMs: 0, iterations: "infinite", direction: "normal", fillMode: "both", playState: "running" }, 2.25)).toBeCloseTo(0.25);
    expect(sampleOpacity({ durationMs: 1000, delayMs: 0, iterations: "infinite", direction: "normal", fillMode: "both", playState: "running" }, 100.25)).toBeCloseTo(0.25);
  });

  it("samples frame-size tracks into the Skia-facing visual content", () => {
    const project = filterProject({ id: "resized", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    project.layers[0].tracks = [
      {
        id: "resize-width",
        path: "frame.width",
        keyframes: [
          { time: 0, value: { type: "number", value: 240 } },
          { time: 1000, value: { type: "number", value: 520 } },
        ],
        playback: { durationMs: 1000, delayMs: 0, iterations: 1, direction: "normal", fillMode: "both", playState: "running" },
      },
      {
        id: "resize-height",
        path: "frame.height",
        keyframes: [
          { time: 0, value: { type: "number", value: 120 } },
          { time: 1000, value: { type: "number", value: 300 } },
        ],
        playback: { durationMs: 1000, delayMs: 0, iterations: 1, direction: "normal", fillMode: "both", playState: "running" },
      },
    ];
    const runtime = compileProtocolAtTime(project, 0.5);
    const node = runtime.visual.nodes.find((candidate) => candidate.id === "filtered-path");
    expect(node?.content).toMatchObject({ width: 380, height: 210 });
  });

  it("applies jump-start easing at the first animation instant", () => {
    const project = filterProject({ id: "steps", primitives: [] }) as any;
    project.filters = [];
    project.layers[0].filter = undefined;
    project.layers[0].style = { fill: "#2563eb" };
    project.layers[0].tracks = [{
      id: "steps-color",
      path: "style.fill",
      keyframes: [
        { time: 0, value: { type: "color", value: [0x25 / 255, 0x63 / 255, 0xeb / 255, 1] }, easing: { type: "step", count: 4, position: "jump-start" } },
        { time: 1000, value: { type: "color", value: [0xfa / 255, 0xcc / 255, 0x15 / 255, 1] } },
      ],
      playback: { durationMs: 1000, delayMs: 0, iterations: 1, direction: "normal", fillMode: "both", playState: "running" },
    }];
    expect(sampleMotionProtocolAtTime(project, 0).layers[0]?.style?.fill).toBe("#5a7db6");
  });

  it("samples linear, step and cubic-bezier easing deterministically", () => {
    const sampleOpacity = (easing: V2Easing, time: number) => {
      const project = filterProject({ id: "easing", primitives: [] }) as any;
      project.filters = [];
      project.layers[0].filter = undefined;
      project.layers[0].tracks = [{
        id: "easing-opacity",
        path: "opacity",
        keyframes: [
          { time: 0, value: { type: "number", value: 0 }, easing },
          { time: 1000, value: { type: "number", value: 1 } },
        ],
        playback: { durationMs: 1000, delayMs: 0, iterations: 1, direction: "normal", fillMode: "both", playState: "running" },
      }];
      return sampleMotionProtocolAtTime(project, time).layers[0]?.opacity;
    };

    expect(sampleOpacity({ type: "linear" }, 0.5)).toBeCloseTo(0.5);
    expect(sampleOpacity({ type: "step", count: 4, position: "jump-end" }, 0.3)).toBeCloseTo(0.25);
    expect(sampleOpacity({ type: "step", count: 4, position: "jump-start" }, 0)).toBeCloseTo(0.25);
    expect(sampleOpacity({ type: "step", count: 4, position: "jump-start" }, 0.3)).toBeCloseTo(0.5);
    expect(sampleOpacity({ type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }, 0.5)).toBeCloseTo(0.8024, 3);
  });

  it("resolves SVG paint references and authoring lengths at the compiler boundary", () => {
    const project = filterProject({ id: "unused", primitives: [] });
    project.filters = [];
    project.paintServers = [{
      id: "brand",
      paint: {
        type: "linear-gradient" as const,
        stops: [{ offset: 0, color: "#00aa88" }, { offset: 1, color: "#ff3366" }],
      },
    }];
    project.layers[0] = {
      ...project.layers[0]!,
      filter: undefined,
      style: {
        fill: { type: "reference" as const, id: "brand" },
        stroke: "#ffffff",
        strokeWidth: { value: 2, unit: "px" as const },
        strokeDash: { array: [{ value: 10, unit: "percent" as const }, 5], offset: -4 },
      },
    };
    const buffer = compileProtocolToPaintCommands(project);
    const path = buffer.commands.find((command) => command.op === "drawPath");
    expect(path).toMatchObject({
      strokeWidth: 2,
      strokeDash: { array: expect.any(Array), offset: -4 },
      fillPaint: { type: "linear-gradient", stops: expect.any(Array) },
    });
  });

});

function fixtureProject(id: string) {
  const fixture = V2_AUDIO_FIXTURES.find((item) => item.id === id);
  if (!fixture) throw new Error(`${id} fixture is missing`);
  return fixture.project;
}

function filterProject(filter: { id: string; primitives: unknown[] }) {
  return {
    format: "motion-protocol" as const,
    formatVersion: 2 as const,
    id: "svg-filter-project",
    composition: {
      width: 960,
      height: 540,
      fps: 30,
      background: "#101820",
      colorSpace: "srgb" as const,
      view: {
        projection: { kind: "orthographic" as const, zoom: 1, near: 1, far: 4000 },
        transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } },
      },
    },
    assets: [],
    filters: [filter],
    layers: [{
      id: "filtered-path",
      type: "path" as const,
      parentLayerId: null,
      order: 0,
      frame: { width: 960, height: 540 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 3000 },
      filter: filter.id,
      payload: {
        contours: [{ id: "contour", start: { x: 200, y: 100 }, segments: [
          { kind: "line" as const, to: { x: 700, y: 100 } },
          { kind: "line" as const, to: { x: 700, y: 400 } },
          { kind: "line" as const, to: { x: 200, y: 400 } },
        ], closed: true }],
        fillRule: "nonzero" as const,
      },
      style: { fill: "#00aa88" },
    }],
    audio: { sampleRate: 48000 as const, tracks: [] },
  };
}
