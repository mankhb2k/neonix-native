import { visualLayerAtoms } from "@motionvideo/patterns";
/**
 * Engineering diagnostic bench — NOT a production performance acceptance gate.
 * Soft main-thread budget is JOURNAL_VALIDATE_SOFT_BUDGET_MS (100ms).
 * Production offloads docs ≥ JOURNAL_VALIDATE_OFFLOAD_BYTES via worker thread.
 *
 * Writes JSON artifact to tmp/journal-autosave-bench.json with median/p95 per
 * size for machine-specific CI or release-benchmark thresholds. Do not claim
 * production FPS or ship gates from this suite alone.
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "../../../../shared/project-file/envelope";
import { validateDesktopDocumentJson } from "../../../../shared/project-file/validate-document";
import {
  JOURNAL_VALIDATE_OFFLOAD_BYTES,
  JOURNAL_VALIDATE_SOFT_BUDGET_MS,
  hashDocumentJson,
} from "./project-journal.service";
import {
  resolveJournalValidateWorkerPath,
  validateAndHashDocument,
} from "../journal-validate/journal-document.validator";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const artifactPath = path.join(
  desktopRoot,
  "tmp",
  "journal-autosave-bench.json",
);

function inflateToTargetBytes(base: string, targetBytes: number): string {
  const envelope = JSON.parse(base) as {
    project: { layers: unknown[] };
  };
  const node = {
    id: "node_bench_pad",
    type: "text",
    parentLayerId: null,
    zIndex: 0,
    timing: { start: 0, duration: 3 },
    ...visualLayerAtoms({
      x: 100,
      y: 100,
      width: 400,
      height: 80,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0.5,
      originY: 0.5,
      opacity: 100,
      visible: true,
    }),
    payload: {
      text: "",
      fontSize: 64,
      color: "#000000",
      alignment: "center",
      wrap: "word",
      overflow: "clip",
    },
  };
  envelope.project.layers = [node];
  let json = JSON.stringify(envelope);
  const deficit = targetBytes - Buffer.byteLength(json, "utf8");
  if (deficit > 0) {
    node.payload.text = "x".repeat(deficit);
    json = JSON.stringify(envelope);
  }
  return json;
}

function percentileMs(samples: number[], p: number): number {
  const s = [...samples].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const idx = Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1);
  return s[Math.max(0, idx)] ?? 0;
}

function measureSync(documentJson: string, rounds: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const t0 = performance.now();
    validateDesktopDocumentJson(documentJson);
    hashDocumentJson(documentJson);
    samples.push(performance.now() - t0);
  }
  return samples;
}

describe("journal autosave size bench", () => {
  it("writes diagnostic JSON for 1MB/5MB/20MB (soft signal, not acceptance)", async () => {
    const blank = buildBlankDesktopProject({ name: "Bench" });
    const rounds = 5;
    const sizes = [
      {
        label: "1MB",
        bytes: 1_000_000,
        softMs: JOURNAL_VALIDATE_SOFT_BUDGET_MS,
      },
      {
        label: "5MB",
        bytes: 5_000_000,
        softMs: JOURNAL_VALIDATE_SOFT_BUDGET_MS,
      },
      {
        label: "20MB",
        bytes: 20_000_000,
        softMs: JOURNAL_VALIDATE_SOFT_BUDGET_MS,
      },
    ] as const;

    const rows: Array<Record<string, unknown>> = [];
    for (const size of sizes) {
      const inflated = inflateToTargetBytes(blank.documentJson, size.bytes);
      const actual = Buffer.byteLength(inflated, "utf8");
      expect(actual).toBeGreaterThanOrEqual(size.bytes * 0.98);

      const samples = measureSync(inflated, rounds);
      const median = percentileMs(samples, 50);
      const p95 = percentileMs(samples, 95);
      console.info(
        `[journal-bench] ${size.label} bytes=${actual} medianMs=${median.toFixed(1)} p95Ms=${p95.toFixed(1)} softBudgetMs=${size.softMs} overSoft=${median > size.softMs}`,
      );

      rows.push({
        label: size.label,
        bytes: actual,
        rounds,
        samplesMs: samples,
        medianMs: median,
        p95Ms: p95,
        softBudgetMs: size.softMs,
        overSoftBudget: median > size.softMs,
      });

      // CI diagnostic ceiling only — release gates use artifact + target machine.
      expect(p95).toBeLessThan(30_000);
      if (median > size.softMs) {
        expect(actual).toBeGreaterThanOrEqual(JOURNAL_VALIDATE_OFFLOAD_BYTES);
      }
    }

    let workerVia: string | null = null;
    const sample = inflateToTargetBytes(blank.documentJson, 1_000_000);
    const workerPath = resolveJournalValidateWorkerPath();
    if (workerPath) {
      const result = await validateAndHashDocument(sample, {
        offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
        workerPath,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.via).toBe("worker");
        workerVia = result.via;
      }
    } else {
      console.info(
        "[journal-bench] worker bundle missing — run `pnpm --filter @motionvideo/desktop build:main`",
      );
    }

    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(
      artifactPath,
      `${JSON.stringify(
        {
          kind: "journal-autosave-bench",
          acceptance: false,
          diagnosticOnly: true,
          note: "Diagnostic median/p95 only. Do not use as production performance claim. Set machine-specific release thresholds from this artifact on target hardware.",
          softBudgetMs: JOURNAL_VALIDATE_SOFT_BUDGET_MS,
          offloadBytes: JOURNAL_VALIDATE_OFFLOAD_BYTES,
          recordedAt: new Date().toISOString(),
          platform: process.platform,
          arch: process.arch,
          sizes: rows,
          workerPath,
          workerVia,
        },
        null,
        2,
      )}\n`,
    );
    console.info(`[journal-bench] wrote ${artifactPath}`);
  }, 120_000);
});
