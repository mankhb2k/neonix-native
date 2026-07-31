/**
 * Micro-benchmark command seam for Phase 0 performance-baseline.md numbers.
 *   pnpm --filter @motionvideo/web exec tsx scripts/bench-vite-phase0-commands.ts
 */

import { performance } from "node:perf_hooks";
import {
  fixtureBasePlusOverlay,
  fixtureMainOnly,
} from "../lib/editor/__fixtures__/projects";
import { withDeterministicIds } from "../lib/editor/__fixtures__/vite-phase0";
import { executeTimelineCommand } from "../lib/editor/timeline";

function bench(name: string, n: number, fn: () => void) {
  // warmup
  for (let i = 0; i < 10; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  const avgMs = (performance.now() - t0) / n;
  return { name, n, avgMs: Number(avgMs.toFixed(3)) };
}

const results = withDeterministicIds(() => {
  const { project, clips, lanes } = fixtureMainOnly();
  const doc = { project, clips, lanes };
  const overlay = fixtureBasePlusOverlay();
  const odoc = {
    project: overlay.project,
    clips: overlay.clips,
    lanes: overlay.lanes,
  };
  return [
    bench("move-clip", 200, () => {
      executeTimelineCommand(doc, {
        type: "move-clip",
        clipId: "clip.main.b",
        patch: { startTime: 3 },
      });
    }),
    bench("trim-clip", 200, () => {
      executeTimelineCommand(doc, {
        type: "clip/trim",
        clipId: "clip.main.a",
        duration: 1.25,
        startTime: 0,
      });
    }),
    bench("split-clip", 100, () => {
      executeTimelineCommand(
        doc,
        { type: "split-selected-clips", time: 1 },
        { kind: "clips", ids: ["clip.main.a"], primaryId: "clip.main.a" },
      );
    }),
    bench("delete-clip", 200, () => {
      executeTimelineCommand(
        odoc,
        { type: "delete-selected-clips" },
        { kind: "clips", ids: ["clip.overlay"], primaryId: "clip.overlay" },
      );
    }),
  ];
});

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
