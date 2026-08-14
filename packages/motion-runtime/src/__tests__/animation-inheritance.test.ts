/**
 * Phase 5 — Animation inheritance tests (Group Layer Semantics).
 *
 * Verifies the V1 group animation contract:
 *   - Animating a group transform moves all descendants
 *   - Child local animation combines with parent animation
 *   - Group opacity animation cascades to children
 *   - Group visibility animation hides children
 */
import { describe, expect, it } from "vitest";
import { evaluateScene, type RuntimeNode, type RuntimeScene } from "../evaluator";

// ── Helpers ───────────────────────────────────────────────────────────

function makeGroupScene(opts: {
  groupTransform?: Partial<RuntimeNode["transform"]>;
  groupTiming?: RuntimeNode["timing"];
  childTransform?: Partial<RuntimeNode["transform"]>;
  childTiming?: RuntimeNode["timing"];
  tracks?: RuntimeScene["tracks"];
} = {}): RuntimeScene {
  return {
    id: "scene.test",
    duration: 10,
    layers: [
      {
        id: "group.char",
        type: "group",
        parentLayerId: null,
        zIndex: 1,
        timing: opts.groupTiming ?? { start: 0, duration: 10 },
        transform: {
          x: 100,
          y: 200,
          width: 200,
          height: 200,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
          depth: 0,
          ...opts.groupTransform,
        },
        payload: { compositing: { mode: "pass-through" as const } },
      },
      {
        id: "head",
        type: "image",
        parentLayerId: "group.char",
        zIndex: 0,
        timing: opts.childTiming ?? { start: 0, duration: 10 },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
          depth: 0,
          ...opts.childTransform,
        },
        payload: { assetId: "asset.head" },
      },
    ],
    tracks: opts.tracks ?? [],
  } as RuntimeScene;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("V1 group animation inheritance (Phase 5)", () => {
  it("animating group.transform.x moves child world position", () => {
    const scene = makeGroupScene({
      tracks: [
        {
          layerId: "group.char",
          property: "transform.x",
          keys: [
            { t: 0, v: 100 },
            { t: 2, v: 300 },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    });

    // At t=0: group x=100, child local x=0 → child should be at world x ≈ 100
    const atT0 = evaluateScene(scene, 0);
    const headAt0 = atT0.find((n) => n.layer.id === "head")!;
    expect(headAt0).toBeDefined();
    expect(headAt0.visible).toBe(true);

    // At t=2: group x=300, child local x=0 → child should be at world x ≈ 300
    const atT2 = evaluateScene(scene, 2);
    const headAt2 = atT2.find((n) => n.layer.id === "head")!;
    expect(headAt2).toBeDefined();
    expect(headAt2.visible).toBe(true);

    // Child's world e-component (worldMatrix.e) should shift right with parent
    expect(headAt2.worldMatrix.e).toBeGreaterThan(headAt0.worldMatrix.e);
  });

  it("animating group.transform.y moves child world position", () => {
    const scene = makeGroupScene({
      tracks: [
        {
          layerId: "group.char",
          property: "transform.y",
          keys: [
            { t: 0, v: 200 },
            { t: 2, v: 500 },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    });

    const atT0 = evaluateScene(scene, 0);
    const headAt0 = atT0.find((n) => n.layer.id === "head")!;
    const atT2 = evaluateScene(scene, 2);
    const headAt2 = atT2.find((n) => n.layer.id === "head")!;

    // Child's world f-component (worldMatrix.f) should shift down with parent
    expect(headAt2.worldMatrix.f).toBeGreaterThan(headAt0.worldMatrix.f);
  });

  it("animating group.transform.rotation rotates child", () => {
    const scene = makeGroupScene({
      tracks: [
        {
          layerId: "group.char",
          property: "transform.rotation",
          keys: [
            { t: 0, v: 0 },
            { t: 2, v: 90 },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    });

    const atT0 = evaluateScene(scene, 0);
    const headAt0 = atT0.find((n) => n.layer.id === "head")!;
    const atT2 = evaluateScene(scene, 2);
    const headAt2 = atT2.find((n) => n.layer.id === "head")!;

    // Rotation changes should affect child's world matrix differently
    // At t=0 (rotation=0), matrix should not be identity (due to position)
    // At t=2 (rotation=90), a/b/c/d should differ from t=0
    expect(headAt2.worldMatrix.a).not.toBe(headAt0.worldMatrix.a);
  });

  it("animating group.transform.opacity cascades to child worldOpacity (inheritOpacity true)", () => {
    const scene = makeGroupScene({
      tracks: [
        {
          layerId: "group.char",
          property: "transform.opacity",
          keys: [
            { t: 0, v: 1 },
            { t: 2, v: 0.5 },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    });

    const atT0 = evaluateScene(scene, 0);
    const headAt0 = atT0.find((n) => n.layer.id === "head")!;
    const atT2 = evaluateScene(scene, 2);
    const headAt2 = atT2.find((n) => n.layer.id === "head")!;

    // At t=0: group opacity=1 × child opacity=1 → worldOpacity ≈ 1
    expect(headAt0.worldOpacity).toBeCloseTo(1, 5);
    // At t=2: group opacity=0.5 × child opacity=1 → worldOpacity ≈ 0.5
    expect(headAt2.worldOpacity).toBeCloseTo(0.5, 5);
  });

  it("animating group.transform.visible hides descendants", () => {
    const scene = makeGroupScene({
      groupTransform: { visible: true },
      tracks: [
        {
          layerId: "group.char",
          property: "transform.visible",
          keys: [
            { t: 0, v: true },
            { t: 0.5, v: false },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    });

    // At t=0: group visible=true → child visible
    const atT0 = evaluateScene(scene, 0);
    const headAt0 = atT0.find((n) => n.layer.id === "head")!;
    expect(headAt0.visible).toBe(true);

    // At t=1: group visible=false → child hidden
    const atT1 = evaluateScene(scene, 1);
    const headAt1 = atT1.find((n) => n.layer.id === "head")!;
    expect(headAt1.visible).toBe(false);
  });

  it("child local animation combines with parent animation", () => {
    const scene = makeGroupScene({
      tracks: [
        // Parent: group moves from x=100 to x=300
        {
          layerId: "group.char",
          property: "transform.x",
          keys: [
            { t: 0, v: 100 },
            { t: 2, v: 300 },
          ],
        } as RuntimeScene["tracks"][number],
        // Child: head rotates from 0 to 45 degrees locally
        {
          layerId: "head",
          property: "transform.rotation",
          keys: [
            { t: 0, v: 0 },
            { t: 2, v: 45 },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    });

    const atT0 = evaluateScene(scene, 0);
    const headAt0 = atT0.find((n) => n.layer.id === "head")!;
    const atT2 = evaluateScene(scene, 2);
    const headAt2 = atT2.find((n) => n.layer.id === "head")!;

    // Both: child should be visible at both times
    expect(headAt0.visible).toBe(true);
    expect(headAt2.visible).toBe(true);

    // Parent movement: world e should increase
    expect(headAt2.worldMatrix.e).toBeGreaterThan(headAt0.worldMatrix.e);

    // Child rotation: world matrix rotation components should differ from
    // the pure-parent-movement case (a/b should differ between t0 and t2)
    expect(headAt2.worldMatrix.a).not.toBe(headAt0.worldMatrix.a);
    expect(headAt2.worldMatrix.b).not.toBe(headAt0.worldMatrix.b);
  });

  it("child animation is evaluated in parent-relative coordinate space", () => {
    // Group at world (500, 300) with rotation 0
    // Child local x=10 means "10px right of group's local origin"
    const scene = makeGroupScene({
      groupTransform: { x: 500, y: 300, rotation: 0 },
      childTransform: { x: 10, y: 0, rotation: 0 },
      tracks: [
        // Animate child local x from 10 to 60
        {
          layerId: "head",
          property: "transform.x",
          keys: [
            { t: 0, v: 10 },
            { t: 2, v: 60 },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    });

    const atT0 = evaluateScene(scene, 0);
    const headAt0 = atT0.find((n) => n.layer.id === "head")!;
    const atT2 = evaluateScene(scene, 2);
    const headAt2 = atT2.find((n) => n.layer.id === "head")!;

    // Both should be visible
    expect(headAt0.visible).toBe(true);
    expect(headAt2.visible).toBe(true);

    // Child's world position moves right as child local x increases
    expect(headAt2.worldMatrix.e).toBeGreaterThan(headAt0.worldMatrix.e);
  });

  it("three-level nested group animation cascades to leaf node", () => {
    const scene: RuntimeScene = {
      id: "scene.deep",
      duration: 10,
      layers: [
        {
          id: "g.root",
          type: "group",
          parentLayerId: null,
          zIndex: 1,
          timing: { start: 0, duration: 10 },
          transform: {
            x: 100, y: 200, width: 200, height: 200,
            rotation: 0, scaleX: 1, scaleY: 1,
            anchorX: 0.5, anchorY: 0.5,
            opacity: 1, visible: true,
            flipX: false, flipY: false, depth: 0,
          },
          payload: { compositing: { mode: "pass-through" as const } },
        },
        {
          id: "g.mid",
          type: "group",
          parentLayerId: "g.root",
          zIndex: 1,
          timing: { start: 0, duration: 10 },
          transform: {
            x: 50, y: 0, width: 100, height: 100,
            rotation: 0, scaleX: 1, scaleY: 1,
            anchorX: 0.5, anchorY: 0.5,
            opacity: 1, visible: true,
            flipX: false, flipY: false, depth: 0,
          },
          payload: { compositing: { mode: "pass-through" as const } },
        },
        {
          id: "leaf",
          type: "image",
          parentLayerId: "g.mid",
          zIndex: 0,
          timing: { start: 0, duration: 10 },
          transform: {
            x: 0, y: 0, width: 50, height: 50,
            rotation: 0, scaleX: 1, scaleY: 1,
            anchorX: 0.5, anchorY: 0.5,
            opacity: 1, visible: true,
            flipX: false, flipY: false, depth: 0,
          },
          payload: { assetId: "a" },
        },
      ],
      tracks: [
        // Animate root group horizontal position
        {
          layerId: "g.root",
          property: "transform.x",
          keys: [
            { t: 0, v: 100 },
            { t: 4, v: 500 },
          ],
        } as RuntimeScene["tracks"][number],
        // Animate mid group vertical position
        {
          layerId: "g.mid",
          property: "transform.y",
          keys: [
            { t: 0, v: 0 },
            { t: 4, v: 200 },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    };

    const atT0 = evaluateScene(scene, 0);
    const leafAt0 = atT0.find((n) => n.layer.id === "leaf")!;
    const atT4 = evaluateScene(scene, 4);
    const leafAt4 = atT4.find((n) => n.layer.id === "leaf")!;

    expect(leafAt0.visible).toBe(true);
    expect(leafAt4.visible).toBe(true);

    // Leaf moves right (root x animates) and down (mid y animates)
    expect(leafAt4.worldMatrix.e).toBeGreaterThan(leafAt0.worldMatrix.e);
    expect(leafAt4.worldMatrix.f).toBeGreaterThan(leafAt0.worldMatrix.f);
  });

  it("animated group still respects effective timing (child hidden when group out of window)", () => {
    const scene = makeGroupScene({
      groupTiming: { start: 3, duration: 2 },
      childTiming: { start: 0, duration: 10 },
      tracks: [
        {
          layerId: "group.char",
          property: "transform.x",
          keys: [
            { t: 3, v: 100 },
            { t: 5, v: 300 },
          ],
        } as RuntimeScene["tracks"][number],
      ],
    });

    // At t=1: group not yet active → child culled
    const atT1 = evaluateScene(scene, 1);
    const headAt1 = atT1.find((n) => n.layer.id === "head")!;
    expect(headAt1.visible).toBe(false);
    expect(headAt1.worldOpacity).toBe(0);

    // At t=4: group active → child visible with animated group position
    const atT4 = evaluateScene(scene, 4);
    const headAt4 = atT4.find((n) => n.layer.id === "head")!;
    expect(headAt4.visible).toBe(true);
    expect(headAt4.worldOpacity).toBeGreaterThan(0);
  });
});
