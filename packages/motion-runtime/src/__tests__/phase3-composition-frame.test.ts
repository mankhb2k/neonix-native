import { visualLayerAtoms } from "@motionvideo/patterns";
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
      graphId: "s1",
      layerId: "n1",
      composition: {
        graphId: "s1",
        localTime: 0.5,
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        zIndex: 0,
      },
      interaction: {
        graphId: "s1",
        frame: 15,
        time: 0.5,
        width: 1920,
        height: 1080,
        space: "flat-2d",
        projection: { kind: "orthographic" },
        cameraMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        items: [],
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
      layerId: "n1",
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
    expect(parsed).toEqual({ graphId: "scene-1", layerId: "node-a" });
  });

  it("round-trips with iteration", () => {
    const parsed = parseStableLayerKey("scene-1:node-a::iter3");
    expect(parsed).toEqual({
      graphId: "scene-1",
      layerId: "node-a",
      iteration: 3,
    });
  });

  it("returns null for invalid key", () => {
    expect(parseStableLayerKey("invalid")).toBeNull();
    expect(parseStableLayerKey("")).toBeNull();
  });
});

// ── Task 3.4: Camera view override seam ───────────────────────────────

import { evaluateCompositionFrameV1 } from "../evaluate-composition";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";

function emptyRuntime(): MotionRuntimeProject {
  return {
    format: "motion-runtime",
    formatVersion: 1,
    metadata: {
      id: "test",
      name: "Test",
      aspectRatio: "16:9",
      fps: 30,
      locale: "vi-VN",
      brand: { name: "Default" },
    },
    assets: [],
    space: "flat-2d",
    layers: [
      {
        type: "group",
        id: "n1",
        parentLayerId: null,
        zIndex: 0,
        ...visualLayerAtoms({
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          originX: 0,
          originY: 0,
          opacity: 100,
          visible: true,
        }),
        payload: {},
      } as MotionRuntimeProject["layers"][number],
    ],
    propertyAnimations: [],
    timeline: { duration: 2 },
  };
}

describe("evaluateCompositionFrameV1", () => {
  it("returns EvaluatedCompositionFrame with all fields", () => {
    const runtime = emptyRuntime();
    const frame = evaluateCompositionFrameV1(runtime, 0, 30, 1920, 1080);
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
    const frame = evaluateCompositionFrameV1(runtime, 0, 30, 1920, 1080);
    expect(frame?.projection.kind).toBe("orthographic-2d");
  });

  it("stageView:'flat' produces orthographic-2d even for 2.5d space", () => {
    const runtime = emptyRuntime();
    runtime.space = "layered-2.5d";
    const frame = evaluateCompositionFrameV1(runtime, 0, 30, 1920, 1080, {
      stageView: "flat",
    });
    expect(frame?.projection.kind).toBe("orthographic-2d");
  });

  it("null for out-of-bounds frame", () => {
    const runtime = emptyRuntime();
    // Frame way beyond duration
    const frame = evaluateCompositionFrameV1(runtime, 10000, 30, 1920, 1080);
    expect(frame).toBeNull();
  });
});

// ── Phase 5 — multi-track runtime evaluation ──────────────────────────

import {
  listTimelineSegments,
  resolveTimelineAtTime,
  timelineTotalDuration,
} from "../resolve-timeline";

describe("Phase 5 — layer-graph timeline resolution", () => {
  it("listTimelineSegments covers the full duration once", () => {
    const rt = emptyRuntime();
    const segments = listTimelineSegments(rt);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.graphId).toBe("root");
    expect(segments[0]!.duration).toBe(2);
  });

  it("timelineTotalDuration uses timeline.duration", () => {
    const rt = emptyRuntime();
    expect(timelineTotalDuration(rt)).toBe(2);
    rt.timeline.duration = 5;
    expect(timelineTotalDuration(rt)).toBe(5);
  });

  it("resolveTimelineAtTime maps onto the root graph", () => {
    const rt = emptyRuntime();
    const mid = resolveTimelineAtTime(rt, 1);
    expect(mid).not.toBeNull();
    expect(mid!.graphId).toBe("root");
    expect(mid!.localTime).toBe(1);

    const pastEnd = resolveTimelineAtTime(rt, 10);
    expect(pastEnd).toBeNull();
  });

  it("resolveTimelineAtTime returns null for empty timeline", () => {
    const rt = emptyRuntime();
    rt.timeline.duration = 0;
    expect(resolveTimelineAtTime(rt, 0)).toBeNull();
  });

  it("evaluateCompositionFrameV1 evaluates the layer graph", () => {
    const rt = emptyRuntime();
    const frame = evaluateCompositionFrameV1(rt, 0, 30, 1920, 1080);
    expect(frame).not.toBeNull();
    expect(frame!.compositionTime).toBe(0);
  });
});
