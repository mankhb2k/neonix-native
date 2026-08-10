/**
 * Engine benchmark harness — fixture matrix across scene sizes, frame rates,
 * and pipeline stages (compile, evaluate, paint).
 *
 * Fixture matrix:
 *   small (1 scene, 3 layers) × medium (3 scenes, 10 layers) × large (10 scenes, 30 layers)
 *   × 30fps / 60fps
 *
 * Outputs JSON + Markdown report → docs/benchmark-results/
 *
 * Usage:
 *   pnpm --filter @motionvideo/render-worker exec tsx ../../scripts/benchmark-engine.ts
 *   pnpm --filter @motionvideo/render-worker exec tsx ../../scripts/benchmark-engine.ts --scale=small
 *   pnpm --filter @motionvideo/render-worker exec tsx ../../scripts/benchmark-engine.ts --json-only
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── CLI args ──────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const scaleFilter = args.has("--scale=small")
  ? "small"
  : args.has("--scale=medium")
    ? "medium"
    : args.has("--scale=large")
      ? "large"
      : "all";
const jsonOnly = args.has("--json-only");
const fpsValues = args.has("--fps=30")
  ? [30]
  : args.has("--fps=60")
    ? [60]
    : [30, 60];

// ── Types ─────────────────────────────────────────────────────────────

type ScenarioSize = "small" | "medium" | "large";

interface BenchmarkResult {
  scenario: string;
  size: ScenarioSize;
  fps: number;
  sceneCount: number;
  layerCount: number;
  totalFrames: number;
  /** Wall clock ms */
  compileMs: number;
  evaluateMs: number;
  /** If available: per-frame distribution */
  frameTimeMs: {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
    min: number;
    max: number;
    samples: number;
  };
  /** Memory RSS at end (MB) */
  memoryRssMb: number;
  timestamp: string;
}

interface BenchmarkReport {
  generatedAt: string;
  nodeVersion: string;
  platform: string;
  results: BenchmarkResult[];
}

// ── Fixture factory ───────────────────────────────────────────────────

interface FixtureSpec {
  size: ScenarioSize;
  scenes: number;
  layersPerScene: number;
  durationSec: number;
}

const FIXTURES: FixtureSpec[] = [
  { size: "small", scenes: 1, layersPerScene: 3, durationSec: 5 },
  { size: "medium", scenes: 3, layersPerScene: 10, durationSec: 10 },
  { size: "large", scenes: 10, layersPerScene: 30, durationSec: 30 },
];

function buildFixtureProject(spec: FixtureSpec): {
  id: string;
  sceneCount: number;
  layerCount: number;
  duration: number;
} {
  // In Phase 0 we use lightweight counting; actual compile + evaluate
  // is wired once Phase 1 stabilizes the compiler API.
  // For now, measure the cost of creating the fixture structures
  // and calling key runtime functions N times to warm the JIT.
  const totalLayers = spec.scenes * spec.layersPerScene;
  return {
    id: `bench-${spec.size}-s${spec.scenes}-l${totalLayers}`,
    sceneCount: spec.scenes,
    layerCount: totalLayers,
    duration: spec.durationSec,
  };
}

// ── Measurement helpers ───────────────────────────────────────────────

interface Distribution {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  samples: number;
}

function computeDistribution(samples: number[]): Distribution {
  if (samples.length === 0)
    return { p50: 0, p95: 0, p99: 0, mean: 0, min: 0, max: 0, samples: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)]!,
    p95: sorted[Math.floor(sorted.length * 0.95)]!,
    p99: sorted[Math.floor(sorted.length * 0.99)]!,
    mean: sum / sorted.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    samples: sorted.length,
  };
}

function getMemoryRssMb(): number {
  const mem = process.memoryUsage();
  return Math.round((mem.rss / 1024 / 1024) * 100) / 100;
}

// ── Stub evaluate/paint (Phase 0 — measures overhead of N calls) ─────

/**
 * Phase 0: simulate frame evaluation by creating N lightweight objects
 * and calling Math ops. Real evaluate/paint measurement comes in Phase 1
 * once the compiler produces normalized projects and the evaluator API
 * is stable for direct invocation.
 */
function simulateFrameEval(layerCount: number, frames: number): number[] {
  const samples: number[] = [];
  for (let f = 0; f < frames; f++) {
    const t0 = performance.now();
    // Simulate: transform matrix calc per layer
    for (let l = 0; l < layerCount; l++) {
      const m = [
        Math.cos(f * 0.01 + l),
        -Math.sin(f * 0.01 + l),
        Math.sin(f * 0.01 + l),
        Math.cos(f * 0.01 + l),
        l * 10,
        (layerCount - l) * 5,
      ];
      // Prevent DCE
      void m[0];
    }
    const elapsed = performance.now() - t0;
    samples.push(elapsed);
  }
  return samples;
}

// ── Run benchmark ─────────────────────────────────────────────────────

async function runBenchmark(
  spec: FixtureSpec,
  fps: number,
): Promise<BenchmarkResult> {
  const fixture = buildFixtureProject(spec);
  const totalFrames = Math.ceil(spec.durationSec * fps);

  // 1. Compile time (simulated: fixture creation is our "compile")
  const compileStart = performance.now();
  const compiled = buildFixtureProject(spec);
  const compileMs = performance.now() - compileStart;

  // 2. Evaluate time
  const evalStart = performance.now();
  const frameSamples = simulateFrameEval(spec.layersPerScene, totalFrames);
  const evaluateMs = performance.now() - evalStart;

  // 3. Distribution
  const frameTimeMs = computeDistribution(frameSamples);

  return {
    scenario: `${spec.size} · ${spec.scenes}s × ${spec.layersPerScene}L @ ${fps}fps`,
    size: spec.size,
    fps,
    sceneCount: compiled.sceneCount,
    layerCount: compiled.layerCount,
    totalFrames,
    compileMs: Math.round(compileMs * 100) / 100,
    evaluateMs: Math.round(evaluateMs * 100) / 100,
    frameTimeMs,
    memoryRssMb: getMemoryRssMb(),
    timestamp: new Date().toISOString(),
  };
}

// ── Report generation ─────────────────────────────────────────────────

function generateMarkdown(report: BenchmarkReport): string {
  const lines = [
    `# Engine Benchmark Report`,
    ``,
    `> Generated: ${report.generatedAt}`,
    `> Node: ${report.nodeVersion}`,
    `> Platform: ${report.platform}`,
    ``,
    `## Summary`,
    ``,
    `| Scenario | FPS | Scenes | Layers | Frames | Compile (ms) | Eval (ms) | P50 (ms) | P95 (ms) | P99 (ms) | RSS (MB) |`,
    `|---|---|---|---|---|---|---|---|---|---|---|`,
  ];

  for (const r of report.results) {
    lines.push(
      `| ${r.scenario} | ${r.fps} | ${r.sceneCount} | ${r.layerCount} | ${r.totalFrames} | ${r.compileMs} | ${r.evaluateMs} | ${r.frameTimeMs.p50.toFixed(3)} | ${r.frameTimeMs.p95.toFixed(3)} | ${r.frameTimeMs.p99.toFixed(3)} | ${r.memoryRssMb} |`,
    );
  }

  lines.push(
    ``,
    `## Notes`,
    ``,
    `- Phase 0 baseline — measures fixture creation + simulated per-frame transform math`,
    `- Real compile/evaluate/paint wired in Phase 1`,
    ``,
  );

  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    results: [],
  };

  const selectedFixtures =
    scaleFilter === "all"
      ? FIXTURES
      : FIXTURES.filter((f) => f.size === scaleFilter);

  for (const spec of selectedFixtures) {
    for (const fps of fpsValues) {
      if (!jsonOnly) {
        console.log(
          `[bench] ${spec.size} · ${spec.scenes}s/${spec.layersPerScene}L @ ${fps}fps ...`,
        );
      }
      const result = await runBenchmark(spec, fps);
      report.results.push(result);

      if (!jsonOnly) {
        console.log(
          `  compile ${result.compileMs}ms | eval ${result.evaluateMs}ms | p50 ${result.frameTimeMs.p50.toFixed(3)}ms | p95 ${result.frameTimeMs.p95.toFixed(3)}ms | rss ${result.memoryRssMb}MB`,
        );
      }
    }
  }

  // Write outputs
  const outDir = resolve(ROOT, "docs", "benchmark-results");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    resolve(outDir, "latest.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  writeFileSync(resolve(outDir, "latest.md"), generateMarkdown(report), "utf8");

  if (!jsonOnly) {
    console.log(
      `\n✅ Report written to docs/benchmark-results/latest.{json,md}`,
    );
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((err) => {
  console.error("[bench] FAILED", err);
  process.exit(1);
});
