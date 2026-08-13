/**
 * Phase 2 — runtime IR VNext schema tests (canonical location).
 *
 * Covers the vNext runtime IR surface:
 *  - `composition` metadata (Task 6.2)
 *  - `timeline.visualTracks` visual track plan (Task 6.3)
 *  - `sourceRef` scene + project source refs (Task 6.4)
 *  - `runtimeHash` / `compilerVersion` / `capabilityFingerprint` (Task 6.5)
 *  - `MotionRuntimeProject` canonical type
 *  - backward compatibility: pre-Phase-6 IR still parses
 *  - serializability: no `Map`/`Set`/`Date` survive in the IR
 */
import { describe, expect, it } from "vitest";
import {
  MotionRuntimeProjectSchema,
  RuntimeCompositionMetadataSchema,
  RuntimeClipSourceSchema,
  RuntimeVisualClipSchema,
  RuntimeVisualTrackSchema,
  RuntimeSourceRefSchema,
  RuntimeSourceRefMapSchema,
  type MotionRuntimeProject,
} from "../project";

/** Minimal runtime scene mirroring the Phase 1 single-scene golden. */
function runtimeScene(id = "intro"): Record<string, unknown> {
  return {
    id,
    duration: 5,
    nodes: [
      {
        id: "title",
        type: "text",
        parentId: null,
        zIndex: 1,
        transform: {
          x: 960,
          y: 540,
          width: 800,
          height: 120,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: {
          content: { kind: "plain", text: "Hello MotiClip" },
          fontSize: 64,
          align: "center",
        },
      },
    ],
    tracks: [],
  };
}

/** Minimal pre-Phase-6 runtime IR (the old compiled shape). */
function baseIR(): Record<string, unknown> {
  return {
    format: "motion-runtime",
    formatVersion: 3,
    metadata: {
      id: "rt",
      name: "Runtime",
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: { name: "Default" },
    },
    assets: [],
    timeline: {
      duration: 5,
      visualTracks: [
        {
          id: "primary",
          order: 0,
          clips: [
            {
              id: "clip-intro",
              source: { kind: "scene", sceneId: "intro" },
              start: 0,
              duration: 5,
            },
          ],
        },
      ],
      audioTracks: [],
      captionTracks: [],
    },
    scenes: [runtimeScene()],
  };
}

describe("runtime IR backward compatibility", () => {
  it("pre-Phase-6 IR (no new fields) still parses", () => {
    const parsed = MotionRuntimeProjectSchema.safeParse(baseIR());
    expect(parsed.success).toBe(true);
  });

  it("MotionRuntimeProject is the canonical runtime IR type", () => {
    const project: MotionRuntimeProject =
      MotionRuntimeProjectSchema.parse(baseIR());
    expect(project.format).toBe("motion-runtime");
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
      safeArea: {
        platform: "generic",
        top: 0.05,
        bottom: 0.1,
      },
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
        height: -1080,
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

describe("visual track plan (Task 6.3)", () => {
  it("clip source accepts scene only and rejects component/preset", () => {
    expect(
      RuntimeClipSourceSchema.safeParse({ kind: "scene", sceneId: "intro" })
        .success,
    ).toBe(true);
    expect(
      RuntimeClipSourceSchema.safeParse({
        kind: "component",
        componentId: "button",
      }).success,
    ).toBe(false);
    expect(
      RuntimeClipSourceSchema.safeParse({ kind: "preset", presetId: "x" })
        .success,
    ).toBe(false);
  });

  it("accepts a full visual clip", () => {
    const parsed = RuntimeVisualClipSchema.safeParse({
      id: "clip-intro",
      source: { kind: "scene", sceneId: "intro" },
      start: 0,
      duration: 5,
      trimStart: 0.5,
      playbackRate: 1,
      loop: false,
      opacity: 0.9,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects transition fields on visual clips", () => {
    expect(
      RuntimeVisualClipSchema.safeParse({
        id: "clip-intro",
        source: { kind: "scene", sceneId: "intro" },
        start: 0,
        duration: 5,
        transitionIn: { type: "fade", duration: 0.3 },
      }).success,
    ).toBe(false);
  });

  it("rejects negative start or non-positive duration", () => {
    expect(
      RuntimeVisualClipSchema.safeParse({
        id: "clip-bad",
        source: { kind: "scene", sceneId: "intro" },
        start: -1,
        duration: 5,
      }).success,
    ).toBe(false);
    expect(
      RuntimeVisualClipSchema.safeParse({
        id: "clip-bad",
        source: { kind: "scene", sceneId: "intro" },
        start: 0,
        duration: 0,
      }).success,
    ).toBe(false);
  });

  it("visual track wraps clips and requires unique order (no role)", () => {
    const ok = RuntimeVisualTrackSchema.safeParse({
      id: "track-primary",
      order: 0,
      muted: false,
      clips: [
        {
          id: "clip-intro",
          source: { kind: "scene", sceneId: "intro" },
          start: 0,
          duration: 5,
        },
      ],
    });
    expect(ok.success).toBe(true);
    const bad = RuntimeVisualTrackSchema.safeParse({
      id: "track-bad",
      role: "main",
      order: 0,
      clips: [],
    });
    expect(bad.success).toBe(false);
  });

  it("full IR accepts timeline.visualTracks without sceneOrder", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).visualTracks = [
      {
        id: "track-primary",
        order: 0,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 5,
          },
        ],
      },
    ];
    const parsed = MotionRuntimeProjectSchema.safeParse(ir);
    expect(parsed.success).toBe(true);
    expect(
      (parsed.data as MotionRuntimeProject).timeline.visualTracks,
    ).toHaveLength(1);
  });
});

describe("visual track plan — multi-track fixtures (Phase 1)", () => {
  it("accepts primary + overlay tracks", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).visualTracks = [
      {
        id: "track-primary",
        order: 0,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 5,
          },
        ],
      },
      {
        id: "track-overlay",
        order: 1,
        clips: [
          {
            id: "clip-overlay",
            source: { kind: "scene", sceneId: "intro" },
            start: 3,
            duration: 2,
            opacity: 0.7,
          },
        ],
      },
    ];
    const parsed = MotionRuntimeProjectSchema.safeParse(ir);
    expect(parsed.success).toBe(true);
    expect(
      (parsed.data as MotionRuntimeProject).timeline.visualTracks,
    ).toHaveLength(2);
    expect(
      (parsed.data as MotionRuntimeProject).timeline.visualTracks[1]!.order,
    ).toBe(1);
  });

  it("accepts an empty track (no clips)", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).visualTracks = [
      {
        id: "track-primary",
        order: 0,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 5,
          },
        ],
      },
      {
        id: "track-empty",
        order: 1,
        clips: [],
      },
    ];
    const parsed = MotionRuntimeProjectSchema.safeParse(ir);
    expect(parsed.success).toBe(true);
    expect(
      (parsed.data as MotionRuntimeProject).timeline.visualTracks,
    ).toHaveLength(2);
  });

  it("accepts overlapping clips on the same track", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).duration = 7;
    (ir.timeline as Record<string, unknown>).visualTracks = [
      {
        id: "track-primary",
        order: 0,
        clips: [
          {
            id: "clip-a",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 5,
          },
          {
            id: "clip-b",
            source: { kind: "scene", sceneId: "intro" },
            start: 3,
            duration: 4,
          },
        ],
      },
    ];
    const parsed = MotionRuntimeProjectSchema.safeParse(ir);
    expect(parsed.success).toBe(true);
    expect(
      (parsed.data as MotionRuntimeProject).timeline.visualTracks[0]!.clips,
    ).toHaveLength(2);
  });

  it("rejects transition fields on timeline clips", () => {
    const ir = baseIR();
    ir.timeline = {
      ...(ir.timeline as object),
      visualTracks: [
        {
          id: "primary",
          order: 0,
          clips: [
            {
              id: "c1",
              source: { kind: "scene", sceneId: "intro" },
              start: 0,
              duration: 3,
              transitionOut: { type: "fade", duration: 0.5 },
            },
            {
              id: "c2",
              source: { kind: "scene", sceneId: "intro" },
              start: 3,
              duration: 2,
              transitionIn: { type: "fade", duration: 0.5 },
            },
          ],
        },
      ],
    };
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });

  it("accepts tracks without legacy role field", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).visualTracks = [
      {
        id: "overlay-only",
        order: 0,
        clips: [
          {
            id: "c1",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 2,
          },
        ],
      },
    ];
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(true);
  });
});

describe("source refs (Task 6.4)", () => {
  it("validates per-scene sourceRef", () => {
    expect(
      RuntimeSourceRefSchema.safeParse({
        projectPath: ["scenes", "intro"],
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
      scenes: {
        intro: "scenes:intro",
        "button@clip-1": "components:button#button@1.0.0",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("full IR accepts scene + project sourceRef", () => {
    const ir = baseIR();
    (ir.scenes as unknown[])[0] = {
      ...((ir.scenes as unknown[])[0] as Record<string, unknown>),
      sourceRef: {
        projectPath: ["components", "button"],
        sourceModule: "button@1.0.0",
      },
    };
    ir.sourceRef = { scenes: { intro: "components:button#button@1.0.0" } };
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
    (ir.timeline as Record<string, unknown>).visualTracks = [
      {
        id: "track-primary",
        order: 0,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 5,
          },
        ],
      },
    ];
    ir.sourceRef = { scenes: { intro: "scenes:intro" } };
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

describe("timeline.duration (Phase 5)", () => {
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

  it("accepts duration 0 (empty draft)", () => {
    const ir = baseIR();
    const timeline = ir.timeline as Record<string, unknown>;
    timeline.duration = 0;
    timeline.visualTracks = [
      { id: "primary", order: 0, clips: [] },
    ];
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(true);
  });

  it("rejects a visual clip that ends beyond duration", () => {
    const ir = baseIR();
    // baseIR's clip is start 0 + duration 5 → ends at 5.
    (ir.timeline as Record<string, unknown>).duration = 3;
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });

  it("rejects a caption token that ends beyond duration", () => {
    const ir = baseIR();
    (ir.timeline as Record<string, unknown>).duration = 1;
    (ir.timeline as Record<string, unknown>).captionTracks = [
      {
        id: "caption-1",
        locale: "vi-VN",
        tokens: [{ id: "tok-1", text: "hi", start: 0, end: 5 }],
        style: { fontSize: 48, fill: "#ffffff" },
      },
    ];
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });

  it("rejects an audio track that ends beyond duration", () => {
    const ir = baseIR();
    const timeline = ir.timeline as Record<string, unknown>;
    timeline.duration = 1;
    timeline.visualTracks = [
      { id: "primary", order: 0, clips: [] },
    ];
    timeline.audioTracks = [
      { id: "audio-1", order: -1, clips: [{ id: "audio-1-clip", assetId: "a", start: 0, duration: 2 }] },
    ];
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(false);
  });

  it("accepts an audio track exactly ending at duration", () => {
    const ir = baseIR();
    const timeline = ir.timeline as Record<string, unknown>;
    timeline.duration = 2;
    timeline.visualTracks = [
      { id: "primary", order: 0, clips: [] },
    ];
    timeline.audioTracks = [
      { id: "audio-1", order: -1, clips: [{ id: "audio-1-clip", assetId: "a", start: 0, duration: 2 }] },
    ];
    expect(MotionRuntimeProjectSchema.safeParse(ir).success).toBe(true);
  });
});
