import { describe, expect, it } from "vitest";
import { V2_AUDIO_FIXTURES } from "@motionvideo/motion-protocol";
import type { RuntimeMediaCatalogV3 } from "@motionvideo/motion-runtime";
import {
  compileProtocol,
  compileProtocolToPaintCommands,
  COMPILER_SUPPORTED_FEATURES,
  isCompilerFeatureSupported,
} from "./index";

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
