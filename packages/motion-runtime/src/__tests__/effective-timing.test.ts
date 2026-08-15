import { visualLayerAtoms } from "@motionvideo/motion-protocol";
/**
 * Phase 3 — Effective timing tests (Group Layer Semantics).
 *
 * Verifies the V1 parent-relative timing contract:
 *   - Child timing is parent-relative
 *   - Child visibility is clipped by ancestor timing
 *   - Missing child timing = full parent duration
 *   - Moving parent moves children
 */
import { describe, expect, it } from "vitest";
import {
  resolveEffectiveTiming,
  isNodeTimeActive,
  nodeLocalTime,
  type EffectiveTiming,
} from "../composition/effective-timing";
import type { RuntimeNode } from "../evaluator";

// ── Node helpers ───────────────────────────────────────────────────────

function g(
  id: string,
  overrides: Partial<RuntimeNode> & {
    parentLayerId?: string | null;
    timing?: { start: number; duration: number };
  } = {},
): RuntimeNode {
  return {
    id,
    type: "group",
    parentLayerId: overrides.parentLayerId ?? null,
    zIndex: 0,
    timing: overrides.timing,
    ...visualLayerAtoms({ x: 0, y: 0, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, opacity: 100, visible: true }),
    payload: {},
    ...overrides,
  } as RuntimeNode;
}

function img(
  id: string,
  overrides: Partial<RuntimeNode> & {
    parentLayerId?: string | null;
    timing?: { start: number; duration: number };
  } = {},
): RuntimeNode {
  return g(id, { ...overrides, type: "image", payload: { assetId: "a" } as any });
}

// ── resolveEffectiveTiming unit tests ──────────────────────────────────

describe("resolveEffectiveTiming", () => {
  it("root node without timing gets full scene duration", () => {
    const layers: RuntimeNode[] = [
      g("a", { parentLayerId: null }),
    ];
    const result = resolveEffectiveTiming(layers, 10);
    const t = result.get("a")!;
    expect(t.effectiveStart).toBe(0);
    expect(t.effectiveEnd).toBe(10);
    expect(t.effectiveDuration).toBe(10);
  });

  it("root node with explicit timing", () => {
    const layers: RuntimeNode[] = [
      g("a", { parentLayerId: null, timing: { start: 2, duration: 3 } }),
    ];
    const result = resolveEffectiveTiming(layers, 10);
    const t = result.get("a")!;
    expect(t.effectiveStart).toBe(2);
    expect(t.effectiveEnd).toBe(5);
    expect(t.effectiveDuration).toBe(3);
  });

  it("child timing is parent-relative", () => {
    // parent: effective 2-5  (start=5, duration=4 → offset 5 from scene)
    // child: timing.start=1, duration=2
    // child effective = parent start + 1 = 3, end = min(5, 3+2=5) = 5
    const layers: RuntimeNode[] = [
      g("parent", { parentLayerId: null, timing: { start: 5, duration: 4 } }),
      img("child", { parentLayerId: "parent", timing: { start: 1, duration: 2 } }),
    ];
    const result = resolveEffectiveTiming(layers, 10);
    const ct = result.get("child")!;
    expect(ct.effectiveStart).toBe(6); // 5 + 1
    expect(ct.effectiveEnd).toBe(8); // min(9, 6+2=8) = 8
    expect(ct.effectiveDuration).toBe(2);
  });

  it("child end is clipped by parent end", () => {
    // parent: 2-5
    // child: start=2, duration=5 → raw end = 4+5=9, clipped to 5
    const layers: RuntimeNode[] = [
      g("parent", { parentLayerId: null, timing: { start: 2, duration: 3 } }),
      img("child", { parentLayerId: "parent", timing: { start: 2, duration: 5 } }),
    ];
    const result = resolveEffectiveTiming(layers, 10);
    const ct = result.get("child")!;
    expect(ct.effectiveStart).toBe(4); // 2 + 2
    expect(ct.effectiveEnd).toBe(5); // min(5, 4+5=9) → clipped
    expect(ct.effectiveDuration).toBe(1);
  });

  it("missing child timing = full parent duration", () => {
    const layers: RuntimeNode[] = [
      g("parent", { parentLayerId: null, timing: { start: 3, duration: 5 } }),
      img("child", { parentLayerId: "parent" }),
    ];
    const result = resolveEffectiveTiming(layers, 10);
    const ct = result.get("child")!;
    expect(ct.effectiveStart).toBe(3); // parent start + 0
    expect(ct.effectiveEnd).toBe(8); // parent end
    expect(ct.effectiveDuration).toBe(5); // full parent duration
  });

  it("three-level nested groups resolve correctly", () => {
    // scene duration = 10
    // group.character:     start=5, dur=4  → effective 5-9
    // group.upper-body:    start=1, dur=2  → effective 6-8
    // group.head-rig:      start=0.5, dur=1.5 → effective 6.5-8
    // head-image:          start=0, dur=1  → effective 6.5-7.5
    const layers: RuntimeNode[] = [
      g("group.character", { parentLayerId: null, timing: { start: 5, duration: 4 } }),
      g("group.upper-body", { parentLayerId: "group.character", timing: { start: 1, duration: 2 } }),
      g("group.head-rig", { parentLayerId: "group.upper-body", timing: { start: 0.5, duration: 1.5 } }),
      img("head-image", { parentLayerId: "group.head-rig", timing: { start: 0, duration: 1 } }),
    ];
    const result = resolveEffectiveTiming(layers, 10);

    expect(result.get("group.character")!.effectiveStart).toBe(5);
    expect(result.get("group.character")!.effectiveEnd).toBe(9);

    expect(result.get("group.upper-body")!.effectiveStart).toBe(6);
    expect(result.get("group.upper-body")!.effectiveEnd).toBe(8);

    expect(result.get("group.head-rig")!.effectiveStart).toBe(6.5);
    expect(result.get("group.head-rig")!.effectiveEnd).toBe(8);

    expect(result.get("head-image")!.effectiveStart).toBe(6.5);
    expect(result.get("head-image")!.effectiveEnd).toBe(7.5);
  });
});

// ── isNodeTimeActive tests ──────────────────────────────────────────────

describe("isNodeTimeActive", () => {
  const t: EffectiveTiming = {
    effectiveStart: 5,
    effectiveEnd: 9,
    effectiveDuration: 4,
  };

  it("false before start", () => {
    expect(isNodeTimeActive(t, 4)).toBe(false);
  });

  it("true at start", () => {
    expect(isNodeTimeActive(t, 5)).toBe(true);
  });

  it("true during active window", () => {
    expect(isNodeTimeActive(t, 7)).toBe(true);
  });

  it("false at end (exclusive)", () => {
    expect(isNodeTimeActive(t, 9)).toBe(false);
  });

  it("false after end", () => {
    expect(isNodeTimeActive(t, 10)).toBe(false);
  });
});

// ── nodeLocalTime tests ─────────────────────────────────────────────────

describe("nodeLocalTime", () => {
  const t: EffectiveTiming = {
    effectiveStart: 5,
    effectiveEnd: 9,
    effectiveDuration: 4,
  };

  it("zero at effective start", () => {
    expect(nodeLocalTime(t, 5)).toBe(0);
  });

  it("mid-window", () => {
    expect(nodeLocalTime(t, 7)).toBe(2);
  });

  it("clamps negative to 0", () => {
    expect(nodeLocalTime(t, 3)).toBe(0);
  });
});

// ── Integration: moving parent moves child ─────────────────────────────

describe("effective timing — parent movement", () => {
  it("moving group from start=5 to start=2 moves child from 6-8 to 3-5", () => {
    const layers: RuntimeNode[] = [
      g("parent", { parentLayerId: null, timing: { start: 2, duration: 4 } }),
      img("child", { parentLayerId: "parent", timing: { start: 1, duration: 2 } }),
    ];
    const result = resolveEffectiveTiming(layers, 10);
    const ct = result.get("child")!;
    // parent effective: 2-6, child: 2+1=3 to min(6, 3+2=5) = 5
    expect(ct.effectiveStart).toBe(3);
    expect(ct.effectiveEnd).toBe(5);
  });
});
