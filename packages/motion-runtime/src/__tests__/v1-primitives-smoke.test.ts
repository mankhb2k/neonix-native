/**
 * V1 Runtime Primitives Smoke Test
 *
 * Validates core runtime primitives against inline V1 fixtures — no
 * external fixture files, no golden PNG comparisons, no V2/compat paths.
 *
 * Phase 3 (compat-removal): replaces validate-runtime-primitives.ts.
 */

import { describe, expect, it } from "vitest";
import { visualLayerAtoms } from "@motionvideo/patterns";
import {
  applyMatrix,
  deterministicRandom,
  evaluateScene,
  frameIndexAtTime,
  frameTimestamp,
  hitTestScene,
  invertMatrix,
  planOffscreenSurface,
  subtreeBounds,
} from "../index";

// ── Helpers ──────────────────────────────────────────────────────────

function pointAt(
  evaluated: ReturnType<typeof evaluateScene>,
  layerId: string,
): { x: number; y: number } {
  const item = evaluated.find(({ layer }) => layer.id === layerId);
  if (!item) throw new Error(`Evaluated node missing: ${layerId}`);
  return applyMatrix(item.worldMatrix, 0, 0);
}

// ── Inline V1-compiled runtime scene (bone hierarchy) ───────────────

function makeHierarchyScene() {
  return {
    id: "scene.main",
    name: "Main",
    duration: 3,
    layers: [
      {
        id: "group.root",
        type: "group" as const,
        parentLayerId: null,
        ...visualLayerAtoms({
          x: 540,
          y: 960,
          width: 540,
          height: 540,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          originX: 0.5,
          originY: 0.5,
          opacity: 100,
          visible: true,
          depth: 0,
        }),
        timing: { start: 0, duration: 3 },
      },
      {
        id: "group.child",
        type: "group" as const,
        parentLayerId: "group.root",
        ...visualLayerAtoms({
          x: 100,
          y: -200,
          width: 60,
          height: 60,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          originX: 0.5,
          originY: 0.5,
          opacity: 100,
          visible: true,
          depth: 0,
        }),
        timing: { start: 0, duration: 3 },
      },
      {
        id: "prop",
        type: "shape" as const,
        parentLayerId: "group.child",
        ...visualLayerAtoms({
          x: 80,
          y: 0,
          width: 40,
          height: 40,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          originX: 0.5,
          originY: 0.5,
          opacity: 65,
          visible: true,
          depth: 0,
        }),
        payload: { width: 40, height: 40, color: "#ff0000" },
        timing: { start: 0, duration: 3 },
      },
    ],
    propertyAnimations: [],
  } as any;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("V1 runtime primitives smoke", () => {
  it("frame clock and determinism", () => {
    expect(frameTimestamp(30, 30)).toEqual({
      frameIndex: 30,
      fps: 30,
      time: 1,
    });
    expect(frameIndexAtTime(0.999, 30)).toBe(29);
    expect(() => frameTimestamp(-1, 30)).toThrow();

    const r1 = deterministicRandom("seed", "scope", 42);
    const r2 = deterministicRandom("seed", "scope", 42);
    const r3 = deterministicRandom("seed", "scope", 41);
    expect(r1).toBe(r2);
    expect(r1).not.toBe(r3);
    expect(r1).toBeGreaterThanOrEqual(0);
    expect(r1).toBeLessThan(1);
  });

  it("evaluates hierarchy at t=0", () => {
    const scene = makeHierarchyScene();
    const frame = evaluateScene(scene, 0);

    const root = pointAt(frame, "group.root");
    const child = pointAt(frame, "group.child");
    const prop = pointAt(frame, "prop");

    // root at local-origin world (x - w*anchorX, y - h*anchorY) = (270, 690)
    expect(root.x).toBeGreaterThan(0);
    expect(root.y).toBeGreaterThan(0);
    // child is deeper in hierarchy than root
    expect(child.x).not.toBe(root.x);
    expect(child.y).not.toBe(root.y);
    // prop is deeper than child
    expect(prop.x).toBeGreaterThan(child.x);
  });

  it("hit-test finds visible layers, skips hidden ones", () => {
    const scene = makeHierarchyScene();
    // "prop" shape at world roughly (400,440)-(440,480) → hit inside
    const hits = hitTestScene(scene, 0, { x: 420, y: 460 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.layer.id === "prop")).toBe(true);

    // Hide prop — hit-test must skip it
    const hiddenScene = makeHierarchyScene();
    const hiddenProp = hiddenScene.layers.find((n: any) => n.id === "prop")!;
    hiddenProp.opacity = 0;
    const hiddenHits = hitTestScene(hiddenScene, 0, { x: 420, y: 460 });
    expect(hiddenHits.some((h) => h.layer.id === "prop")).toBe(false);
  });

  it("computes subtree bounds", () => {
    const scene = makeHierarchyScene();
    const frame = evaluateScene(scene, 0);
    const bounds = subtreeBounds(frame, "group.child");
    expect(bounds).toBeDefined();
    expect(bounds!.width).toBeGreaterThan(0);
    expect(bounds!.height).toBeGreaterThan(0);
  });

  it("inverse matrix round-trips correctly", () => {
    const scene = makeHierarchyScene();
    const frame = evaluateScene(scene, 0);
    const root = frame.find(({ layer }) => layer.id === "group.root")!;

    const inverse = invertMatrix(root.worldMatrix);
    expect(inverse).toBeDefined();

    const center = applyMatrix(root.worldMatrix, 0, 0);
    const local = applyMatrix(inverse!, center.x, center.y);
    expect(local.x).toBeCloseTo(0, 4);
    expect(local.y).toBeCloseTo(0, 4);
  });

  it("plans offscreen surface with safe limits", () => {
    const surface = planOffscreenSurface(
      { x: 0.25, y: 1.5, width: 10.2, height: 20.2 },
      2,
    );
    expect(surface).toEqual({
      originX: -2,
      originY: -1,
      width: 15,
      height: 25,
      pixelCount: 375,
    });

    expect(() =>
      planOffscreenSurface({ x: 0, y: 0, width: 9_000, height: 1 }),
    ).toThrow();
  });
});
