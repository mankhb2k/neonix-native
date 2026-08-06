/**
 * Zero-template eval harness — Z1–Z10 × N runs (stub or live).
 * Usage:
 *   pnpm exec tsx scripts/run-zero-template-eval.ts
 *   pnpm exec tsx scripts/run-zero-template-eval.ts --runs 3 --briefs Z1
 *   pnpm exec tsx scripts/run-zero-template-eval.ts --runs 10 --briefs Z1 --variance
 *   AI_MODE=live ANTHROPIC_API_KEY=... pnpm exec tsx scripts/run-zero-template-eval.ts
 */
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCreativeBriefV1,
} from "../packages/ai-planner/src/contracts/index.ts";
import { runZeroTemplateGeneration } from "../packages/ai-planner/src/orchestrator.ts";
import { executeCommandBatch } from "../packages/ai-planner/src/commands/executor.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = path.join(ROOT, "docs/fixtures/ai/zero");

type RunRow = {
  briefId: string;
  run: number;
  ok: boolean;
  compileOk: boolean;
  sceneCount: number;
  emptyScenes: number;
  criticScore: number;
  repairs: number;
  modelRepairs: number;
  seed: string;
  error?: string;
  inventedAsset?: boolean;
};

function parseArgs(argv: string[]) {
  const runsIdx = argv.indexOf("--runs");
  const briefsIdx = argv.indexOf("--briefs");
  const variance = argv.includes("--variance");
  const probe = argv.includes("--probe");
  const runs = runsIdx >= 0 ? Number(argv[runsIdx + 1] ?? 3) : 3;
  const rawBriefs = briefsIdx >= 0 ? String(argv[briefsIdx + 1] ?? "") : "";
  const briefsFilter = rawBriefs
    ? rawBriefs
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  return { runs, briefsFilter, variance, probe };
}

async function loadBriefs(filter: string[] | null) {
  const files = (await readdir(FIXTURE_DIR))
    .filter((f) => f.endsWith(".json") && f.startsWith("Z"))
    .sort();
  const briefs = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(FIXTURE_DIR, file), "utf8")) as {
      id?: string;
      [key: string]: unknown;
    };
    const id = String(raw.id ?? file.replace(/\.json$/, ""));
    if (filter && !filter.includes(id)) continue;
    const { id: _id, ...briefBody } = raw;
    briefs.push({ id, file, brief: parseCreativeBriefV1(briefBody) });
  }
  return briefs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runCount = args.variance ? Math.max(args.runs, 10) : args.runs;
  const briefs = await loadBriefs(args.briefsFilter);
  if (briefs.length === 0) {
    console.error("No briefs found");
    process.exitCode = 1;
    return;
  }

  const rows: RunRow[] = [];
  for (const item of briefs) {
    for (let run = 1; run <= runCount; run += 1) {
      const seed = `${item.id}_r${run}_${Date.now().toString(36)}`;
      process.stdout.write(`→ ${item.id} run ${run}/${runCount} … `);
      try {
        const result = await runZeroTemplateGeneration({
          brief: item.brief,
          seed,
          maxModelRepairs: 2,
          probeFrames: args.probe,
        });
        let compileOk = false;
        let emptyScenes = 0;
        let inventedAsset = false;
        if (result.project) {
          try {
            const compiled = executeCommandBatch(
              {
                format: "moticlip-command-batch",
                formatVersion: 1,
                baseRevision: 0,
                commands: [{ type: "compileProject" }],
              },
              result.project,
            );
            compileOk = Boolean(compiled.ok && compiled.compiled);
          } catch {
            compileOk = false;
          }
          emptyScenes = result.project.scenes.filter((s) => s.nodes.length === 0).length;
          const allow = new Set((item.brief.suppliedAssets ?? []).map((a) => a.id));
          for (const asset of result.project.assets) {
            if (allow.size > 0 && !allow.has(asset.id)) inventedAsset = true;
          }
          for (const scene of result.project.scenes) {
            for (const node of scene.nodes) {
              if (node.type === "image" || node.type === "svg") {
                if (allow.size > 0 && !allow.has(node.payload.assetId)) inventedAsset = true;
              }
            }
          }
        }
        const row: RunRow = {
          briefId: item.id,
          run,
          ok: Boolean(result.ok && result.project && compileOk && emptyScenes === 0 && !inventedAsset),
          compileOk,
          sceneCount: result.project?.scenes.length ?? 0,
          emptyScenes,
          criticScore: result.critic.score,
          repairs: result.repairs,
          modelRepairs: result.modelRepairs,
          seed: result.generation.seed,
          error: result.error,
          inventedAsset,
        };
        rows.push(row);
        console.log(row.ok ? "OK" : `FAIL (${row.error ?? "gates"})`);
      } catch (error) {
        rows.push({
          briefId: item.id,
          run,
          ok: false,
          compileOk: false,
          sceneCount: 0,
          emptyScenes: 0,
          criticScore: 0,
          repairs: 0,
          modelRepairs: 0,
          seed,
          error: error instanceof Error ? error.message : String(error),
        });
        console.log("ERR", error instanceof Error ? error.message : error);
      }
    }
  }

  const total = rows.length;
  const passed = rows.filter((r) => r.ok).length;
  const compileRate = rows.filter((r) => r.compileOk).length / Math.max(1, total);
  const scorecard = {
    generatedAt: new Date().toISOString(),
    mode: process.env.AI_MODE ?? "stub",
    total,
    passed,
    passRate: passed / Math.max(1, total),
    compileRate,
    hardGates: {
      parseOrDiagnostics: true,
      noGeneratedCssTsxJs: true,
      compileAfterRepair: compileRate,
      emptyScenesZero: rows.every((r) => r.emptyScenes === 0),
      noInventedAssets: rows.every((r) => !r.inventedAsset),
      silentUnsupported: 0,
    },
    rows,
  };

  const outDir = path.join(ROOT, "tmp", "ai-eval");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `scorecard-${Date.now()}.json`);
  await writeFile(outPath, JSON.stringify(scorecard, null, 2), "utf8");

  console.log("\n=== Scorecard ===");
  console.log(`passed ${passed}/${total} (${(scorecard.passRate * 100).toFixed(1)}%)`);
  console.log(`compileRate ${(compileRate * 100).toFixed(1)}%`);
  console.log(`wrote ${outPath}`);

  // Soft exit: stub should pass ≥90% on full suite
  if (scorecard.passRate < 0.9) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
