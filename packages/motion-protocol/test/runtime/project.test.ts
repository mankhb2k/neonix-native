/**
 * Runtime IR schema tests — layer graph, no serialized scenes or clip tracks.
 */
import { describe, expect, it } from "vitest";
import {
  MotionRuntimeProjectSchema,
  RuntimeCompositionMetadataSchema,
  RuntimeSourceRefSchema,
  RuntimeSourceRefMapSchema,
  type MotionRuntimeProject,
} from "../../src/runtime/project";
import { visualLayerAtoms } from "../../src/v1/layer-atoms";

function runtimeLayer(id = "title"): Record<string, unknown> {
  return {
    id,
    type: "text",
    parentLayerId: null,
    zIndex: 1,
    timing: { start: 0, duration: 5 },
    ...visualLayerAtoms({ x: 960, y: 540, width: 800, height: 120, rotation: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, opacity: 100, visible: true }),
    payload: {
      content: { kind: "plain", text: "Hello MotiClip" },
      fontSize: 64,
      align: "center",
    },
  };
}

function baseIR(): Record<string, unknown> {
  return {
    format: "motion-runtime",
    formatVersion: 1,
    runtimeVersion: 3,
    metadata: {
      id: "rt",
      name: "Runtime",
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: { name: "Default" },
    },
    assets: [],
    layers: [runtimeLayer()],
    tracks: [],
    timeline: { duration: 5 },
  };
}

describe("runtime IR layer graph", () => {
  it("parses a layers-only project", () => {
    const parsed = MotionRuntimeProjectSchema.safeParse(baseIR());
    expect(parsed.success).toBe(true);
  });

  it("MotionRuntimeProject is the canonical runtime IR type", () => {
    const project: MotionRuntimeProject =
      MotionRuntimeProjectSchema.parse(baseIR());
    expect(project.format).toBe("motion-runtime");
    expect(project.layers).toHaveLength(1);
    expect(project.tracks).toEqual([]);
  });

  it("strict-rejects serialized scenes", () => {
    const ir = baseIR();
    ir.scenes = [];
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });

  it("strict-rejects timeline.visualTracks / audioTracks / captionTracks", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).visualTracks = [];
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);

    const audio = baseIR();
    (audio.timeline as Record<string, unknown>).audioTracks = [];
    expect(MotionRuntimeProjectSchema.safeParse(audio).success).toBe(false);

    const captions = baseIR();
    (captions.timeline as Record<string, unknown>).captionTracks = [];
    expect(MotionRuntimeProjectSchema.safeParse(captions).success).toBe(false);
  });
});

describe("composition metadata (Task 6.2)", () => {
  it("accepts a full composition block", () => {
    const parsed = RuntimeCompositionMetadataSchema.safeParse({
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#000000",
      colorSpace: "srgb",
      audioSampleRate: 44100,
    });
    expect(parsed.success).toBe(true);
  });

  it("defaults colorSpace to srgb", () => {
    const parsed = RuntimeCompositionMetadataSchema.parse({
      width: 1920,
      height: 1080,
      fps: 60,
    });
    expect(parsed.colorSpace).toBe("srgb");
  });

  it("rejects invalid dimensions and fps", () => {
    expect(
      RuntimeCompositionMetadataSchema.safeParse({
        width: 0,
        height: 1080,
        fps: 30,
      }).success,
    ).toBe(false);
    expect(
      RuntimeCompositionMetadataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    expect(
      RuntimeCompositionMetadataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        gamma: 2.2,
      }).success,
    ).toBe(false);
  });
});

describe("source refs (Task 6.4)", () => {
  it("validates per-layer sourceRef", () => {
    expect(
      RuntimeSourceRefSchema.safeParse({
        projectPath: ["layers", "title"],
      }).success,
    ).toBe(true);
    expect(
      RuntimeSourceRefSchema.safeParse({
        projectPath: ["components", "button"],
        sourceModule: "button@1.0.0",
      }).success,
    ).toBe(true);
    expect(RuntimeSourceRefSchema.safeParse({ projectPath: [] }).success).toBe(
      false,
    );
  });

  it("validates the project-level source ref map", () => {
    const parsed = RuntimeSourceRefMapSchema.safeParse({
      layers: {
        title: "layers:title",
        badge: "components:button#button@1.0.0",
      },
    });
    expect(parsed.success).toBe(true);
    expect(
      RuntimeSourceRefMapSchema.safeParse({
        scenes: { intro: "scenes:intro" },
      }).success,
    ).toBe(false);
  });

  it("full IR accepts project sourceRef.layers", () => {
    const ir = baseIR();
    ir.sourceRef = { layers: { title: "layers:title" } };
    const parsed = MotionRuntimeProjectSchema.safeParse(ir);
    expect(parsed.success).toBe(true);
  });
});

describe("runtime hash inputs (Task 6.5)", () => {
  it("full IR accepts runtimeHash, compilerVersion, capabilityFingerprint", () => {
    const ir = baseIR();
    ir.compilerVersion = "2.0.0-phase6";
    ir.capabilityFingerprint = "0123456789abcdef";
    ir.runtimeHash = "a".repeat(32);
    const parsed = MotionRuntimeProjectSchema.safeParse(ir);
    expect(parsed.success).toBe(true);
  });

  it("rejects oversized hash fields", () => {
    const ir = baseIR();
    ir.runtimeHash = "x".repeat(200);
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });
});

describe("serializability (Task 6.6)", () => {
  it("full IR round-trips through JSON without losing fields", () => {
    const ir = baseIR();
    ir.composition = {
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#000000",
      colorSpace: "srgb",
      audioSampleRate: 44100,
    };
    ir.sourceRef = { layers: { title: "layers:title" } };
    ir.compilerVersion = "2.0.0-phase6";
    ir.capabilityFingerprint = "0123456789abcdef";
    ir.runtimeHash = "a".repeat(32);

    const parsed = MotionRuntimeProjectSchema.parse(ir);
    const roundTripped = MotionRuntimeProjectSchema.parse(
      JSON.parse(JSON.stringify(parsed)),
    );
    expect(roundTripped.composition).toEqual(parsed.composition);
    expect(roundTripped.sourceRef).toEqual(parsed.sourceRef);
    expect(roundTripped.runtimeHash).toBe(parsed.runtimeHash);
    expect(roundTripped.layers).toEqual(parsed.layers);
  });

  it("serialized IR contains no Map/Set/Date instances", () => {
    const parsed = MotionRuntimeProjectSchema.parse(baseIR());
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain("Map");
    expect(serialized).not.toContain("Set");
    expect(JSON.parse(serialized)).toEqual(JSON.parse(serialized));
  });

  it("IR validates standalone after parse (full surface)", () => {
    const ir = baseIR();
    ir.composition = { width: 1080, height: 1920, fps: 30 };
    const parsed = MotionRuntimeProjectSchema.parse(ir);
    expect(MotionRuntimeProjectSchema.safeParse(parsed).success).toBe(true);
  });
});

describe("timeline.duration", () => {
  it("accepts an explicit timeline duration", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).duration = 10;
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(true);
  });

  it("rejects missing timeline.duration", () => {
    const ir = baseIR();
    delete (ir.timeline as Record<string, unknown>).duration;
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });

  it("accepts duration 0 with empty layers", () => {
    const ir = baseIR();
    ir.layers = [];
    (ir.timeline as Record<string, unknown>).duration = 0;
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(true);
  });

  it("rejects a visual layer that ends beyond duration", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).duration = 3;
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });

  it("rejects an audio layer that ends beyond duration", () => {
    const ir = baseIR();
    ir.layers = [
      {
        id: "music",
        type: "audio",
        parentLayerId: null,
        zIndex: -1,
        timing: { start: 0, duration: 2 },
        payload: { assetId: "a" },
      },
    ];
    (ir.timeline as Record<string, unknown>).duration = 1;
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });

  it("accepts an audio layer exactly ending at duration", () => {
    const ir = baseIR();
    ir.layers = [
      {
        id: "music",
        type: "audio",
        parentLayerId: null,
        zIndex: -1,
        timing: { start: 0, duration: 2 },
        payload: { assetId: "a" },
      },
    ];
    (ir.timeline as Record<string, unknown>).duration = 2;
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(true);
  });
});
