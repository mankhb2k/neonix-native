import { describe, expect, it } from "vitest";
import { createDomStageRenderer } from "../../renderer/src/editor/stage/stage-renderer-port";
import {
  buildStagePaintFixture,
  PREVIEW_FRAME_BUDGET_MS,
} from "../../renderer/src/editor/stage/preview-fixtures";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const t = rank - lo;
  return sorted[lo]! * (1 - t) + sorted[hi]! * t;
}

describe("stage renderer DOM paint benchmark", () => {
  it("paintFrame median/p95 for 100 nodes over ~60 frames", () => {
    const fixture = buildStagePaintFixture(100);
    const host = document.createElement("div");
    document.body.appendChild(host);

    const renderer = createDomStageRenderer(host);
    renderer.setDocument(fixture);
    renderer.setScale(0.25);
    renderer.setBackground("#111");

    // Warm compile path / first DOM create outside measured loop.
    renderer.paintFrame(0);

    const samples: number[] = [];
    const frames = 60;
    for (let frame = 1; frame <= frames; frame += 1) {
      const t0 = performance.now();
      renderer.paintFrame(frame);
      samples.push(performance.now() - t0);
    }

    renderer.dispose();
    host.remove();

    samples.sort((a, b) => a - b);
    const median = percentile(samples, 50);
    const p95 = percentile(samples, 95);

     
    console.log(
      `[stage-renderer-benchmark] nodes=100 frames=${frames} median=${median.toFixed(3)}ms p95=${p95.toFixed(3)}ms budget=${PREVIEW_FRAME_BUDGET_MS.toFixed(3)}ms`,
    );

    expect(samples).toHaveLength(frames);
    expect(Number.isFinite(median)).toBe(true);
    expect(Number.isFinite(p95)).toBe(true);
    // Generous gate: p95 under 50× frame budget (CI happy-dom variance).
    expect(p95).toBeLessThan(PREVIEW_FRAME_BUDGET_MS * 50);
  });
});
