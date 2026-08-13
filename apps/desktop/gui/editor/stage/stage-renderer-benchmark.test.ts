import { describe, expect, it } from "vitest";
import { createDomStageRenderer } from "./stage-renderer-port";
import {
  buildStagePaintFixture,
  PREVIEW_FIXTURE_SIZES,
  PREVIEW_FRAME_BUDGET_MS,
} from "./preview-fixtures";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const t = rank - lo;
  return sorted[lo]! * (1 - t) + sorted[hi]! * t;
}

/**
 * CI happy-dom multipliers — finite regression gates, not Electron 60fps acceptance.
 * 100 uses *5 per H2; 500/2000 are looser but still fail on huge regress.
 */
const P95_GATE_MULTIPLIER: Record<(typeof PREVIEW_FIXTURE_SIZES)[number], number> =
  {
    100: 5,
    500: 12,
    2000: 40,
  };

function frameCountForSize(size: number): number {
  return size >= 2000 ? 30 : 60;
}

function testTimeoutForSize(size: number): number {
  if (size >= 2000) return 60_000;
  if (size >= 500) return 30_000;
  return 15_000;
}

describe("stage renderer DOM paint benchmark", () => {
  for (const size of PREVIEW_FIXTURE_SIZES) {
    it(
      `paintFrame median/p95 for ${size} layers`,
      () => {
        const fixture = buildStagePaintFixture(size);
        const host = document.createElement("div");
        document.body.appendChild(host);

        const renderer = createDomStageRenderer(host);
        renderer.setDocument(fixture);
        renderer.setScale(0.25);
        renderer.setBackground("#111");

        // Warm compile path / first DOM create outside measured loop.
        renderer.paintFrame(0);

        const samples: number[] = [];
        const frames = frameCountForSize(size);
        for (let frame = 1; frame <= frames; frame += 1) {
          const t0 = performance.now();
          renderer.paintFrame(frame);
          samples.push(performance.now() - t0);
        }

        renderer.dispose();
        host.remove();

        const sorted = [...samples].sort((a, b) => a - b);
        const median = percentile(sorted, 50);
        const p95 = percentile(sorted, 95);
        const max = sorted[sorted.length - 1]!;
        const overBudget = samples.filter(
          (ms) => ms > PREVIEW_FRAME_BUDGET_MS,
        ).length;

        console.log(
          `[stage-renderer-benchmark] layers=${size} frames=${frames} median=${median.toFixed(3)}ms p95=${p95.toFixed(3)}ms max=${max.toFixed(3)}ms overBudget=${overBudget}/${frames} budget=${PREVIEW_FRAME_BUDGET_MS.toFixed(3)}ms gate=${(PREVIEW_FRAME_BUDGET_MS * P95_GATE_MULTIPLIER[size]).toFixed(3)}ms`,
        );

        expect(samples).toHaveLength(frames);
        expect(Number.isFinite(median)).toBe(true);
        expect(Number.isFinite(p95)).toBe(true);
        expect(Number.isFinite(max)).toBe(true);
        expect(p95).toBeLessThan(
          PREVIEW_FRAME_BUDGET_MS * P95_GATE_MULTIPLIER[size],
        );
      },
      testTimeoutForSize(size),
    );
  }
});
