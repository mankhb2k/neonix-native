/**
 * UI-0.1 / CSS-0 microbench: createClipGroupMovePlan.resolve hot path.
 * Warmup + median of trials; absolute budget (not “2× recreate + 1ms”).
 */
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import {
  createClipGroupMovePlan,
  resolveClipGroupMove,
  type TimelineClip,
  type TimelineDocument,
  type TimelineLane,
} from "..";
import { DEFAULT_VISUAL_POLICY } from "../timeline/timeline-clips";

function makeDoc(clipCount: number): {
  doc: Pick<TimelineDocument, "clips" | "lanes">;
  groupIds: string[];
} {
  const lanes: TimelineLane[] = [
    {
      id: "lane.main",
      kind: "visual",
      role: "base",
      name: "Main",
      order: -1,
      policy: { ...DEFAULT_VISUAL_POLICY },
    },
  ];
  const clips: TimelineClip[] = [];
  for (let i = 0; i < clipCount; i += 1) {
    clips.push({
      kind: "scene",
      id: `clip.${i}`,
      sceneId: `scene.${i}`,
      laneId: "lane.main",
      startTime: i * 2,
      duration: 1,
      name: `C${i}`,
    });
  }
  const groupIds = clips.slice(0, Math.min(100, clipCount)).map((c) => c.id);
  return { doc: { clips, lanes }, groupIds };
}

function medianMs(samples: number[]): number {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

function timeMs(fn: () => void, iterations: number): number {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  return performance.now() - t0;
}

describe("createClipGroupMovePlan hot path", () => {
  it("plan.resolve matches resolveClipGroupMove for sample deltas", () => {
    const { doc, groupIds } = makeDoc(200);
    const ids = groupIds.slice(0, 10);
    const plan = createClipGroupMovePlan(doc, ids);
    for (const delta of [0, 0.5, -0.25, 3]) {
      expect(plan.resolve(delta)).toEqual(resolveClipGroupMove(doc, ids, delta));
    }
  });

  it("detects collision via prefix-max index", () => {
    const { doc } = makeDoc(20);
    // Move group of first 2 into space occupied by clip 5 (start 10)
    const plan = createClipGroupMovePlan(doc, ["clip.0", "clip.1"]);
    // clip.0 at 0 dur 1 → at 10; clip.1 at 2 → at 12; clip.5 at 10 dur 1 overlaps
    const hit = plan.resolve(10);
    expect(hit.valid).toBe(false);
    if (!hit.valid) expect(hit.reason).toBe("collision");
  });

  it.each([
    { clips: 500, group: 10, budgetMs: 25 },
    { clips: 500, group: 50, budgetMs: 40 },
    { clips: 2000, group: 10, budgetMs: 40 },
    { clips: 2000, group: 50, budgetMs: 60 },
    { clips: 2000, group: 100, budgetMs: 80 },
  ])(
    "plan.resolve median ≤ $budgetMs ms for $clips clips / group $group (200 iters × 5 trials)",
    ({ clips, group, budgetMs }) => {
      const { doc, groupIds } = makeDoc(clips);
      const ids = groupIds.slice(0, group);
      const plan = createClipGroupMovePlan(doc, ids);
      const iterations = 200;

      // Warmup
      for (let i = 0; i < 50; i += 1) plan.resolve(0.1);

      const trials: number[] = [];
      for (let t = 0; t < 5; t += 1) {
        trials.push(timeMs(() => plan.resolve(0.1), iterations));
      }
      const med = medianMs(trials);
      expect(plan.resolve(0.1).valid).toBe(true);
      expect(med).toBeLessThanOrEqual(budgetMs);
    },
  );
});
