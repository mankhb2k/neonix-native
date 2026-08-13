/**
 * Phase 2 tests for editor-core: PreparedRuntimeProject types + RuntimePatch protocol.
 * These only need @motionvideo/motion-protocol and @motionvideo/motion-runtime.
 */
import { describe, it, expect } from "vitest";

// ── Task 2.1: PreparedRuntimeProject types ────────────────────────────

import type {
  StaticGeometry,
  TextLayoutInput,
  CompositingScope,
  DepGraphNode,
} from "@motionvideo/motion-protocol";

describe("PreparedRuntimeProject (type smoke)", () => {
  it("StaticGeometry shape is valid", () => {
    const sg: StaticGeometry = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      localMatrix: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      nodeType: "shape",
    };
    expect(sg.bounds.width).toBe(100);
    expect(sg.nodeType).toBe("shape");
  });

  it("TextLayoutInput shape is valid", () => {
    const tli: TextLayoutInput = {
      layerId: "text-1",
      text: "Hello",
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: 700,
      textAlign: "center",
    };
    expect(tli.fontSize).toBe(24);
  });

  it("CompositingScope shape is valid", () => {
    const scope: CompositingScope = {
      scopeId: "mask-1",
      layerIds: ["node-a", "node-b"],
      reason: "mask",
      sourceLayerId: "mask-src",
    };
    expect(scope.reason).toBe("mask");
  });

  it("DepGraphNode shape is valid", () => {
    const dg: DepGraphNode = {
      layerId: "node-1",
      dependsOn: ["parent-1"],
      dependedOnBy: ["child-1", "child-2"],
    };
    expect(dg.dependedOnBy).toHaveLength(2);
  });
});

// ── Task 2.4: RuntimePatch protocol ───────────────────────────────────

import {
  isPatchStale,
  nextSequence,
  affectedSceneIds,
  PATCH_SEQUENCE_INITIAL,
  type PaintPatch,
  type TrackValuesPatch,
  type StructuralPatch,
} from "@motionvideo/motion-runtime";

describe("RuntimePatch protocol", () => {
  it("PATCH_SEQUENCE_INITIAL is 0", () => {
    expect(PATCH_SEQUENCE_INITIAL).toBe(0);
  });

  it("nextSequence increments", () => {
    expect(nextSequence(0)).toBe(1);
    expect(nextSequence(5)).toBe(6);
  });

  describe("isPatchStale", () => {
    it("returns true for patches with lower sequence", () => {
      const patch: PaintPatch = {
        kind: "paint",
        sequence: 3,
        sceneId: "s1",
        layerId: "n1",
        property: "style.fill",
        value: "#ff0000",
      };
      expect(isPatchStale(patch, 5)).toBe(true);
    });

    it("returns false for patches with equal or higher sequence", () => {
      const patch: PaintPatch = {
        kind: "paint",
        sequence: 5,
        sceneId: "s1",
        layerId: "n1",
        property: "style.fill",
        value: "#ff0000",
      };
      expect(isPatchStale(patch, 5)).toBe(false);
      expect(isPatchStale(patch, 4)).toBe(false);
    });
  });

  describe("affectedSceneIds", () => {
    it("paint patch affects one scene", () => {
      const patch: PaintPatch = {
        kind: "paint",
        sequence: 1,
        sceneId: "scene-a",
        layerId: "n1",
        property: "transform.opacity",
        value: 0.5,
      };
      expect(affectedSceneIds(patch)).toEqual(["scene-a"]);
    });

    it("track-values patch affects one scene", () => {
      const patch: TrackValuesPatch = {
        kind: "track-values",
        sequence: 1,
        sceneId: "scene-a",
        tracks: [],
      };
      expect(affectedSceneIds(patch)).toEqual(["scene-a"]);
    });

    it("structural patch returns all sceneIds", () => {
      const patch: StructuralPatch = {
        kind: "structural",
        sequence: 1,
        scope: "full",
        sceneIds: ["s1", "s2", "s3"],
      };
      expect(affectedSceneIds(patch)).toEqual(["s1", "s2", "s3"]);
    });
  });

  it("all patch kinds are structurally valid", () => {
    const paint: PaintPatch = {
      kind: "paint",
      sequence: 1,
      sceneId: "s",
      layerId: "n",
      property: "style.fill",
      value: "#fff",
    };
    expect(paint.kind).toBe("paint");

    const track: TrackValuesPatch = {
      kind: "track-values",
      sequence: 2,
      sceneId: "s",
      tracks: [
        { layerId: "n", property: "transform.x", keys: [{ t: 0, v: 100 }] },
      ],
    };
    expect(track.kind).toBe("track-values");

    const structural: StructuralPatch = {
      kind: "structural",
      sequence: 3,
      scope: "scene",
      sceneIds: ["s1"],
    };
    expect(structural.kind).toBe("structural");
  });
});
