import { describe, it, expect } from "vitest";
import {
  FRAME_EPSILON,
  GEOMETRY_EPSILON,
  LENGTH_EPSILON,
  roundTimeToFrame,
  quantizeTimeToMilliseconds,
  frameToTime,
  deterministicTieBreak,
  numericThenId,
  deterministicUint32,
  deterministicRandom,
} from "./determinism";

// ── Epsilon constants ─────────────────────────────────────────────────

describe("epsilon constants", () => {
  it("FRAME_EPSILON is larger than bare Number.EPSILON", () => {
    expect(FRAME_EPSILON).toBeGreaterThan(Number.EPSILON);
    expect(FRAME_EPSILON).toBe(Number.EPSILON * 8);
  });

  it("GEOMETRY_EPSILON is appropriate for matrix math", () => {
    expect(GEOMETRY_EPSILON).toBe(1e-12);
  });

  it("LENGTH_EPSILON > GEOMETRY_EPSILON", () => {
    expect(LENGTH_EPSILON).toBeGreaterThan(GEOMETRY_EPSILON);
  });
});

// ── Frame rounding ────────────────────────────────────────────────────

describe("roundTimeToFrame", () => {
  it("returns 0 for frame 0 at any fps", () => {
    expect(roundTimeToFrame(0, 24)).toBe(0);
    expect(roundTimeToFrame(0, 60)).toBe(0);
  });

  it("exact frame boundaries are correct", () => {
    // 1/24 = 0.041666... → frame 1
    expect(roundTimeToFrame(1 / 24, 24)).toBe(1);
    expect(roundTimeToFrame(2 / 24, 24)).toBe(2);
    expect(roundTimeToFrame(24 / 24, 24)).toBe(24);
  });

  it("rounds floating-point drift correctly (60fps edge)", () => {
    // 1001/60000 is a common NTSC drift
    const t = 1001 / 60000;
    // At 60fps: t*60 = 1.001 → floor(1.001 + epsilon) = 1
    expect(roundTimeToFrame(t, 60)).toBe(1);
  });

  it("clamps negative time to 0", () => {
    expect(roundTimeToFrame(-0.001, 30)).toBe(0);
  });

  it("throws for non-finite fps", () => {
    expect(() => roundTimeToFrame(0, 0)).toThrow();
    expect(() => roundTimeToFrame(0, -1)).toThrow();
    expect(() => roundTimeToFrame(0, NaN)).toThrow();
  });
});

describe("quantizeTimeToMilliseconds", () => {
  it("maps sub-millisecond drift to a stable integer", () => {
    expect(quantizeTimeToMilliseconds(1.0004)).toBe(1000);
    expect(quantizeTimeToMilliseconds(1.0005000000000002)).toBe(1000);
    expect(quantizeTimeToMilliseconds(1.001)).toBe(1001);
  });

  it("clamps negative and non-finite time to 0", () => {
    expect(quantizeTimeToMilliseconds(-0.001)).toBe(0);
    expect(quantizeTimeToMilliseconds(Number.NaN)).toBe(0);
    expect(quantizeTimeToMilliseconds(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("frameToTime", () => {
  it("converts correctly", () => {
    expect(frameToTime(0, 24)).toBe(0);
    expect(frameToTime(24, 24)).toBe(1);
    expect(frameToTime(6, 60)).toBe(0.1);
  });

  it("throws for non-integer frame", () => {
    expect(() => frameToTime(1.5, 24)).toThrow();
  });

  it("throws for negative frame", () => {
    expect(() => frameToTime(-1, 24)).toThrow();
  });
});

// ── Sort tie-break ────────────────────────────────────────────────────

describe("deterministicTieBreak", () => {
  it("sorts lexicographically", () => {
    const ids = ["c", "a", "b"];
    expect([...ids].sort(deterministicTieBreak)).toEqual(["a", "b", "c"]);
  });

  it("handles equal strings", () => {
    expect(deterministicTieBreak("x", "x")).toBe(0);
  });

  it("is case-sensitive and consistent with < >", () => {
    expect(deterministicTieBreak("A", "a")).toBeLessThan(0);
    expect(deterministicTieBreak("a", "A")).toBeGreaterThan(0);
  });
});

describe("numericThenId", () => {
  it("sorts by numeric first", () => {
    const items = [
      { order: 3, id: "a" },
      { order: 1, id: "b" },
      { order: 2, id: "c" },
    ];
    items.sort((a, b) => numericThenId(a.order, b.order, a.id, b.id));
    expect(items.map((i) => i.order)).toEqual([1, 2, 3]);
  });

  it("tie-breaks by id when numeric equal", () => {
    const items = [
      { order: 1, id: "c" },
      { order: 1, id: "a" },
      { order: 1, id: "b" },
    ];
    items.sort((a, b) => numericThenId(a.order, b.order, a.id, b.id));
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

// ── Seed quantization ─────────────────────────────────────────────────

describe("deterministicUint32", () => {
  it("produces consistent output for same inputs", () => {
    const a = deterministicUint32("seed", "channel", 0);
    const b = deterministicUint32("seed", "channel", 0);
    expect(a).toBe(b);
  });

  it("different seed → different output", () => {
    const a = deterministicUint32("seed1", "ch", 0);
    const b = deterministicUint32("seed2", "ch", 0);
    expect(a).not.toBe(b);
  });

  it("different channel → different output", () => {
    const a = deterministicUint32("seed", "a", 0);
    const b = deterministicUint32("seed", "b", 0);
    expect(a).not.toBe(b);
  });

  it("different sampleIndex → different output", () => {
    const a = deterministicUint32("seed", "ch", 0);
    const b = deterministicUint32("seed", "ch", 1);
    expect(a).not.toBe(b);
  });

  it("throws for negative sampleIndex", () => {
    expect(() => deterministicUint32("seed", "ch", -1)).toThrow();
  });

  it("throws for non-integer sampleIndex", () => {
    expect(() => deterministicUint32("seed", "ch", 1.5)).toThrow();
  });

  it("returns uint32 range", () => {
    for (let i = 0; i < 100; i++) {
      const v = deterministicUint32("seed", "ch", i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isSafeInteger(v)).toBe(true);
    }
  });

  it("number seed works", () => {
    const v = deterministicUint32(42, "ch", 0);
    expect(typeof v).toBe("number");
    expect(Number.isSafeInteger(v)).toBe(true);
  });
});

describe("deterministicRandom", () => {
  it("returns [0, 1)", () => {
    for (let i = 0; i < 100; i++) {
      const v = deterministicRandom("seed", "ch", i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic", () => {
    expect(deterministicRandom("s", "c", 0)).toBe(
      deterministicRandom("s", "c", 0),
    );
  });
});
