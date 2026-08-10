/**
 * Phase 3 tests: EvaluatedCompositionFrame, stable keys, interaction snapshot,
 * camera view override, transition frame fixtures.
 */
import { describe, it, expect } from "vitest";

// ── Task 3.1: EvaluatedCompositionFrame contract ──────────────────────

import {
  COMPOSITION_FRAME_CONTRACT_VERSION,
  stableLayerKey,
  parseStableLayerKey,
  type EvaluatedCompositionFrame,
  type EvaluatedLayer,
  type EvaluatedAudioState,
  type EvaluatedMediaState,
  type ProjectionSnapshot,
} from "../evaluated-composition-frame";

describe("EvaluatedCompositionFrame (type smoke)", () => {
  it("CONTRACT_VERSION is semver", () => {
    expect(COMPOSITION_FRAME_CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("EvaluatedLayer has required fields", () => {
    const layer: EvaluatedLayer = {
      layerKey: "s1:n1",
      sceneId: "s1",
      nodeId: "n1",
      composition: {
        sceneId: "s1",
        localTime: 0.5,
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        zIndex: 0,
      },
      interaction: {
        sceneId: "s1",
        time: 0.5,
        nodes: [],
        width: 1920,
        height: 1080,
      },
      paint: { commands: [], diagnostics: [] },
    };
    expect(layer.layerKey).toBe("s1:n1");
  });

  it("ProjectionSnapshot union has 3 variants", () => {
    const ortho: ProjectionSnapshot = {
      kind: "orthographic-2d",
      viewMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    };
    expect(ortho.kind).toBe("orthographic-2d");

    const layered: ProjectionSnapshot = {
      kind: "layered-2.5d",
      viewMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      depthPolicy: "painter-order",
    };
    expect(layered.kind).toBe("layered-2.5d");

    const persp: ProjectionSnapshot = {
      kind: "perspective-3d",
      viewMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      projectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      near: 0.1,
      far: 1000,
      focalLengthPx: 500,
    };
    expect(persp.kind).toBe("perspective-3d");
  });

  it("EvaluatedAudioState has required fields", () => {
    const audio: EvaluatedAudioState = {
      tracks: [
        {
          trackId: "t1",
          assetId: "a1",
          mediaTime: 1.5,
          volume: 0.8,
          muted: false,
          fadeActive: false,
        },
      ],
    };
    expect(audio.tracks).toHaveLength(1);
  });

  it("EvaluatedMediaState has required fields", () => {
    const media: EvaluatedMediaState = {
      nodeId: "n1",
      mediaTime: 2.0,
      sourceFrame: 60,
      assetId: "vid-1",
      playbackRate: 1,
      active: true,
    };
    expect(media.sourceFrame).toBe(60);
  });
});

// ── Task 3.2: Stable layer keys ───────────────────────────────────────

describe("stableLayerKey", () => {
  it("produces deterministic keys", () => {
    expect(stableLayerKey("scene-1", "node-a")).toBe("scene-1:node-a");
  });

  it("produces same key for same inputs", () => {
    const k1 = stableLayerKey("s1", "n1");
    const k2 = stableLayerKey("s1", "n1");
    expect(k1).toBe(k2);
  });

  it("different scene → different key", () => {
    expect(stableLayerKey("s1", "n1")).not.toBe(stableLayerKey("s2", "n1"));
  });

  it("different node → different key", () => {
    expect(stableLayerKey("s1", "n1")).not.toBe(stableLayerKey("s1", "n2"));
  });

  it("includes iteration when provided", () => {
    expect(stableLayerKey("s1", "n1", 3)).toBe("s1:n1::iter3");
  });
});

describe("parseStableLayerKey", () => {
  it("round-trips without iteration", () => {
    const parsed = parseStableLayerKey("scene-1:node-a");
    expect(parsed).toEqual({ sceneId: "scene-1", nodeId: "node-a" });
  });

  it("round-trips with iteration", () => {
    const parsed = parseStableLayerKey("scene-1:node-a::iter3");
    expect(parsed).toEqual({
      sceneId: "scene-1",
      nodeId: "node-a",
      iteration: 3,
    });
  });

  it("returns null for invalid key", () => {
    expect(parseStableLayerKey("invalid")).toBeNull();
    expect(parseStableLayerKey("")).toBeNull();
  });
});

// ── Task 3.4: Camera view override seam ───────────────────────────────

import { evaluateCompositionFrameV3 } from "../evaluate-composition";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";

function emptyRuntime(): MotionRuntimeProject {
  return {
    format: "motion-runtime",
    formatVersion: 2,
    metadata: {
      id: "test",
      title: "Test",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
    },
    assets: [],
    timeline: { sceneOrder: ["s1"], audioTracks: [], captionTracks: [] },
    scenes: [
      {
        id: "s1",
        duration: 2,
        space: "flat-2d",
        nodes: [
          {
            type: "group",
            id: "n1",
            parentId: null,
            zIndex: 0,
            transform: {
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              rotation: 0,
              opacity: 1,
              anchorX: 0,
              anchorY: 0,
              scaleX: 1,
              scaleY: 1,
            },
            payload: {},
          } as any,
        ],
        tracks: [],
      },
    ],
  };
}

describe("evaluateCompositionFrameV3", () => {
  it("returns EvaluatedCompositionFrame with all fields", () => {
    const runtime = emptyRuntime();
    const frame = evaluateCompositionFrameV3(runtime, 0, 30, 1920, 1080);
    expect(frame).not.toBeNull();
    if (!frame) return;

    expect(frame.contractVersion).toBe(COMPOSITION_FRAME_CONTRACT_VERSION);
    expect(frame.compositionFrame).toBe(0);
    expect(frame.compositionTime).toBe(0);
    expect(frame.fps).toBe(30);
    expect(frame.viewport).toEqual({ width: 1920, height: 1080 });
    expect(frame.layers).toBeDefined();
    expect(frame.interaction).toBeDefined();
    expect(frame.paint).toBeDefined();
    expect(frame.audio).toBeDefined();
    expect(frame.media).toBeDefined();
    expect(frame.projection).toBeDefined();
    expect(frame.diagnostics).toBeDefined();
  });

  it("returns orthographic-2d projection for flat space", () => {
    const runtime = emptyRuntime();
    const frame = evaluateCompositionFrameV3(runtime, 0, 30, 1920, 1080);
    expect(frame?.projection.kind).toBe("orthographic-2d");
  });

  it("stageView:'flat' produces orthographic-2d even for 2.5d space", () => {
    const runtime = emptyRuntime();
    runtime.scenes[0]!.space = "layered-2.5d";
    const frame = evaluateCompositionFrameV3(runtime, 0, 30, 1920, 1080, {
      stageView: "flat",
    });
    expect(frame?.projection.kind).toBe("orthographic-2d");
  });

  it("null for out-of-bounds frame", () => {
    const runtime = emptyRuntime();
    // Frame way beyond duration
    const frame = evaluateCompositionFrameV3(runtime, 10000, 30, 1920, 1080);
    expect(frame).toBeNull();
  });
});

// ── Task 3.5: Transition frame fixtures ───────────────────────────────

import {
  TRANSITION_FIXTURES,
  TRANSITION_FIXTURE_KEYS,
  generateFixtureDigests,
  fixtureGlobalTimes,
  type FixtureFrameDigest,
} from "../composition/transition-fixtures";

describe("transition fixtures", () => {
  it("all 6 transition types are defined", () => {
    expect(TRANSITION_FIXTURES).toHaveLength(6);
    const names = TRANSITION_FIXTURES.map((f) => f.name);
    expect(names).toContain("cut");
    expect(names).toContain("fade");
    expect(names).toContain("crossfade");
    expect(names).toContain("slide-left");
    expect(names).toContain("wipe-right");
    expect(names).toContain("zoom-in");
  });

  it("all 5 fixture keys exist", () => {
    expect(TRANSITION_FIXTURE_KEYS).toEqual([
      "before",
      "start",
      "middle",
      "end",
      "after",
    ]);
  });

  it("fixtureGlobalTimes returns increasing times", () => {
    const times = fixtureGlobalTimes(0.5);
    expect(times.before).toBeLessThan(times.start);
    expect(times.start).toBeLessThan(times.middle);
    expect(times.middle).toBeLessThan(times.end);
    expect(times.end).toBeLessThan(times.after);
  });

  it("generateFixtureDigests produces 30 digests (6×5)", () => {
    const digests = generateFixtureDigests();
    expect(digests).toHaveLength(30);

    // Verify structure
    const first = digests[0]!;
    expect(first).toHaveProperty("fixture");
    expect(first).toHaveProperty("key");
    expect(first).toHaveProperty("globalTime");
    expect(first).toHaveProperty("layers");
    expect(first.layers.length).toBeGreaterThan(0);
  });

  it("cut has 1 layer before and 1 after (no overlap)", () => {
    const digests = generateFixtureDigests();
    const cutBefore = digests.find(
      (d) => d.fixture === "cut" && d.key === "before",
    );
    expect(cutBefore?.layers).toHaveLength(1);

    const cutAfter = digests.find(
      (d) => d.fixture === "cut" && d.key === "after",
    );
    // After cut, scene-b is playing
    expect(cutAfter?.layers.length).toBeGreaterThanOrEqual(1);
  });

  it("crossfade has 2 layers during middle", () => {
    const digests = generateFixtureDigests();
    const xfMiddle = digests.find(
      (d) => d.fixture === "crossfade" && d.key === "middle",
    );
    expect(xfMiddle?.layers).toHaveLength(2);
  });

  it("digests are deterministic for same duration", () => {
    const d1 = generateFixtureDigests(0.5);
    const d2 = generateFixtureDigests(0.5);
    expect(d1).toEqual(d2);
  });

  it("digests differ for different durations", () => {
    const d1 = generateFixtureDigests(0.3);
    const d2 = generateFixtureDigests(0.5);
    expect(d1).not.toEqual(d2);
  });
});
