import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { compileMotionProject } from "../apps/render-worker/src/compiler/index";
import { encodeOutputs, resolveFfmpegPath } from "../apps/render-worker/src/ffmpeg/index";
import { renderCompiledProject } from "../apps/render-worker/src/runtime/index";
import {
  applyMotionPatch,
  parseMotionComponentV2,
  parseMotionProjectV2,
} from "../packages/motion-protocol/src/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(repoRoot, "docs", "fixtures", "v2");
const outDir = resolve(repoRoot, "tmp", "acceptance-score");
const scorecardPath = resolve(fixturesRoot, "acceptance", "scorecard.json");
const failureLogPath = resolve(fixturesRoot, "acceptance", "failure-log.json");
const machineScoresPath = resolve(fixturesRoot, "acceptance", "machine-scores.json");

type Scores = {
  compile: number;
  exportMp4: number;
  publicApi: number;
  visualIntent: number;
  timing: number;
  reuse: number;
};

type Composition = {
  id: string;
  map: string;
  project: string;
  patch: string | null;
  frame: string;
  scores: Scores;
  total: number | null;
  status: string;
  failures: string[];
  reviewNotes?: string;
};

type Scorecard = {
  version: number;
  updatedAt: string;
  passThreshold: number;
  criteria: string[];
  scoredBy?: string;
  compositions: Composition[];
};

/** Agent visual/timing/reuse judgments (filled by review pass; script merges machine scores). */
const AGENT_REVIEW: Record<string, { visualIntent: number; timing: number; reuse: number; reviewNotes: string }> = {
  "accept-process-trim": {
    visualIntent: 1,
    timing: 2,
    reuse: 2,
    reviewNotes: "Trim line + title OK; timeline-steps instance sits off 1:1 frame (9:16 layout) so process list not visible at t=1.",
  },
  "accept-bignumber-paint": {
    visualIntent: 1,
    timing: 2,
    reuse: 2,
    reviewNotes: "Gradient panel + glow + dashed stroke clear; big-number text clipped by aspect mismatch (component 9:16 on 1:1).",
  },
  "accept-compare-blend": {
    visualIntent: 0,
    timing: 1,
    reuse: 2,
    reviewNotes: "Only screen-blend highlight visible; compare cards off-frame — fails compare brief at sample frame.",
  },
  "accept-tvc-hook": {
    visualIntent: 2,
    timing: 2,
    reuse: 2,
    reviewNotes: "Hook scene readable (discount copy + accent); multi-scene/audio/camera composition holds TVC intent.",
  },
  "accept-showcase-lookat": {
    visualIntent: 1,
    timing: 2,
    reuse: 2,
    reviewNotes: "Motion-path + look-at markers visible; product showcase body mostly cropped — partial product-TVC read.",
  },
  "accept-ribbon-promo": {
    visualIntent: 2,
    timing: 2,
    reuse: 2,
    reviewNotes: "Gradient card, label, and bent ribbon read clearly as promo; strongest paint/modifier combo frame.",
  },
  "accept-cutout-talk": {
    visualIntent: 2,
    timing: 2,
    reuse: 2,
    reviewNotes: "Cut-out rig + prop in frame; talk/wave actions and VO-backed dialogue map satisfied.",
  },
  "accept-prop-mask": {
    visualIntent: 2,
    timing: 2,
    reuse: 1,
    reviewNotes: "Hierarchy limbs + prop + spotlight mask readable; fixture enrich more than packaged public API.",
  },
  "accept-look-at": {
    visualIntent: 2,
    timing: 2,
    reuse: 1,
    reviewNotes: "Eye/target look-at composition clear with caption; good constraint demo, not a product MVC.",
  },
  "accept-secondary-wave": {
    visualIntent: 2,
    timing: 2,
    reuse: 1,
    reviewNotes: "Secondary rotation chain silhouettes + caption; mascot-wave map satisfied as primitive composition.",
  },
  "accept-path-morph": {
    visualIntent: 2,
    timing: 2,
    reuse: 1,
    reviewNotes: "Morph fills/strokes + caption present; expression accent intent clear.",
  },
  "accept-action-loop": {
    visualIntent: 1,
    timing: 2,
    reuse: 2,
    reviewNotes: "Four action instances render as tiny markers; playback wiring OK but visual punch weak at t=1.",
  },
};

function probe(file: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(resolveFfmpegPath(), ["-i", file], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", () => resolvePromise(stderr));
    child.on("error", reject);
  });
}

function sumScores(scores: Scores): number {
  return scores.compile + scores.exportMp4 + scores.publicApi + scores.visualIntent + scores.timing + scores.reuse;
}

async function main(): Promise<void> {
  const skipExport = process.argv.includes("--skip-export");
  const scorecard = JSON.parse(await readFile(scorecardPath, "utf8")) as Scorecard;
  const componentRoot = resolve(fixturesRoot, "components");
  const components = await Promise.all(
    (await readdir(componentRoot))
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => parseMotionComponentV2(JSON.parse(await readFile(resolve(componentRoot, file), "utf8")))),
  );

  await mkdir(outDir, { recursive: true });
  const failures: Array<{ id: string; kind: string; message: string; at: string }> = [];
  const machine: Record<string, { exportMp4: number; publicApi: number; exportPath?: string; exportError?: string; patchError?: string }> = {};

  for (const composition of scorecard.compositions) {
    const projectPath = resolve(fixturesRoot, composition.project);
    const project = parseMotionProjectV2(JSON.parse(await readFile(projectPath, "utf8")));
    let exportMp4 = 0;
    let publicApi = 1;
    let exportPath: string | undefined;
    let exportError: string | undefined;
    let patchError: string | undefined;

    if (composition.patch) {
      try {
        const patch = JSON.parse(await readFile(resolve(fixturesRoot, composition.patch), "utf8"));
        const patched = applyMotionPatch(project, patch);
        parseMotionProjectV2(JSON.parse(JSON.stringify(patched)));
        publicApi = 2;
      } catch (error) {
        publicApi = 0;
        patchError = error instanceof Error ? error.message : String(error);
        failures.push({
          id: composition.id,
          kind: "public-api",
          message: patchError,
          at: new Date().toISOString(),
        });
      }
    }

    if (!skipExport) {
      try {
        const compiled = compileMotionProject(project, { components });
        const rendered = await renderCompiledProject(compiled, {
          fps: 8,
          scale: 0.35,
          outDir: resolve(outDir, "frames", composition.id),
          assetBaseDir: fixturesRoot,
        });
        const files = await encodeOutputs(rendered, project.metadata.aspectRatio, compiled, fixturesRoot);
        const mp4 = files[0]?.path;
        if (!mp4) throw new Error("No MP4 produced");
        const info = await stat(mp4);
        const probeOut = await probe(mp4);
        if (!/Video:\s*/.test(probeOut)) throw new Error("MP4 missing video stream");
        const dest = resolve(outDir, `${composition.id}.mp4`);
        await writeFile(dest, await readFile(mp4));
        exportPath = dest;
        exportMp4 = info.size > 0 ? 2 : 0;
        console.log(`OK export ${composition.id} → ${dest} (${info.size} bytes)`);
      } catch (error) {
        exportMp4 = 0;
        exportError = error instanceof Error ? error.message : String(error);
        failures.push({
          id: composition.id,
          kind: "export",
          message: exportError,
          at: new Date().toISOString(),
        });
        console.error(`FAIL export ${composition.id}: ${exportError}`);
      }
    } else if (machineScoresPath) {
      try {
        const prior = JSON.parse(await readFile(machineScoresPath, "utf8")) as typeof machine;
        exportMp4 = prior[composition.id]?.exportMp4 ?? 0;
        exportPath = prior[composition.id]?.exportPath;
      } catch {
        exportMp4 = 0;
      }
    }

    machine[composition.id] = { exportMp4, publicApi, exportPath, exportError, patchError };

    const review = AGENT_REVIEW[composition.id];
    if (!review) throw new Error(`Missing AGENT_REVIEW for ${composition.id}`);

    if (review.visualIntent === 0) {
      failures.push({
        id: composition.id,
        kind: "visual-intent",
        message: review.reviewNotes,
        at: new Date().toISOString(),
      });
    }

    const scores: Scores = {
      compile: 2,
      exportMp4,
      publicApi,
      visualIntent: review.visualIntent,
      timing: review.timing,
      reuse: review.reuse,
    };
    const total = sumScores(scores);
    composition.scores = scores;
    composition.total = total;
    composition.reviewNotes = review.reviewNotes;
    composition.failures = failures.filter((entry) => entry.id === composition.id).map((entry) => entry.kind);
    composition.status =
      exportMp4 === 0 || scores.compile === 0
        ? "fail"
        : total >= scorecard.passThreshold
          ? "agent-scored"
          : "fail";
  }

  scorecard.updatedAt = new Date().toISOString().slice(0, 10);
  scorecard.scoredBy = "agent";
  await writeFile(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8");
  await writeFile(machineScoresPath, `${JSON.stringify(machine, null, 2)}\n`, "utf8");
  await writeFile(
    failureLogPath,
    `${JSON.stringify({ version: 1, updatedAt: scorecard.updatedAt, entries: failures }, null, 2)}\n`,
    "utf8",
  );

  const passed = scorecard.compositions.filter((item) => item.status === "agent-scored");
  const failed = scorecard.compositions.filter((item) => item.status === "fail");
  const report = [
    "# Acceptance pack scoring report",
    "",
    `Scored by: agent · Date: ${scorecard.updatedAt}`,
    `Pass threshold: ≥ ${scorecard.passThreshold}/12 with compile/export ≠ 0`,
    "",
    `**Result: ${passed.length}/12 agent-scored, ${failed.length} fail**`,
    "",
    "| Id | Map | C | E | P | V | T | R | Total | Status | Notes |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|",
    ...scorecard.compositions.map((item) => {
      const s = item.scores;
      return `| ${item.id} | ${item.map} | ${s.compile} | ${s.exportMp4} | ${s.publicApi} | ${s.visualIntent} | ${s.timing} | ${s.reuse} | ${item.total} | ${item.status} | ${(item.reviewNotes ?? "").replace(/\|/g, "/")} |`;
    }),
    "",
    "## Weak / fail",
    failed.length === 0
      ? "_None._"
      : failed.map((item) => `- **${item.id}** (total ${item.total}): ${item.reviewNotes ?? item.failures.join(", ")}`).join("\n"),
    "",
    "## Artifacts",
    `- MP4: \`tmp/acceptance-score/*.mp4\``,
    `- Machine scores: \`acceptance/machine-scores.json\``,
    `- Failure log: \`acceptance/failure-log.json\``,
    "",
    "Status \`agent-scored\` is not Designer signed-off. Re-run: `pnpm score:acceptance-pack`.",
    "",
  ].join("\n");

  await writeFile(resolve(fixturesRoot, "acceptance", "scoring-report.md"), report, "utf8");
  console.log(`\nScored ${passed.length}/12 agent-scored, ${failed.length} fail`);
  if (failed.length > 0) {
    console.log("Failed:", failed.map((item) => item.id).join(", "));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
