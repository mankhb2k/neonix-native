import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = resolve(repoRoot, "docs", "fixtures", "v2", "acceptance", "designer-corrections.json");

type Run = {
  id: string;
  briefId: string;
  generatedProject?: string;
  publicPatch?: string;
  internalEditCount: number;
  publicOnly: boolean;
  notes?: string;
};

type Ledger = {
  version: number;
  description: string;
  briefs: Array<{ id: string; map: string; prompt: string }>;
  runs: Run[];
};

function score(runs: Run[]): { avgInternalEdits: number; publicOnlyRate: number; ready: boolean } {
  if (runs.length === 0) return { avgInternalEdits: 0, publicOnlyRate: 0, ready: false };
  const avgInternalEdits = runs.reduce((sum, run) => sum + run.internalEditCount, 0) / runs.length;
  const publicOnlyRate = runs.filter((run) => run.publicOnly).length / runs.length;
  return {
    avgInternalEdits,
    publicOnlyRate,
    ready: runs.length >= 4 && avgInternalEdits <= 2 && publicOnlyRate >= 0.75,
  };
}

async function main(): Promise<void> {
  const init = process.argv.includes("--init");
  if (init) {
    const seed: Ledger = {
      version: 1,
      description: "Phase D: count Designer internal edits after AI Author .mt + public patch",
      briefs: [
        { id: "brief-infographic-process", map: "infographic", prompt: "3-step process with trim reveal and accent color prop" },
        { id: "brief-tvc-promo", map: "product-tvc", prompt: "Hook offer CTA coffee promo with public price/CTA props" },
        { id: "brief-cutout-talk", map: "cut-out", prompt: "Cut-out character talk + wave with lip-sync cues" },
        { id: "brief-mascot-wave", map: "mascot", prompt: "Secondary motion tail wave with caption" },
      ],
      runs: [],
    };
    await writeFile(ledgerPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
    console.log("WROTE designer-corrections.json seed briefs");
    return;
  }

  const ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as Ledger;
  if (ledger.briefs.length < 4) throw new Error("Phase D requires at least 4 briefs (one per map)");
  const metrics = score(ledger.runs);
  console.log(
    `OK designer-corrections briefs=${ledger.briefs.length} runs=${ledger.runs.length} avgInternalEdits=${metrics.avgInternalEdits.toFixed(2)} publicOnlyRate=${(metrics.publicOnlyRate * 100).toFixed(0)}% ready=${metrics.ready}`,
  );
  if (ledger.runs.length > 0 && !metrics.ready) {
    console.log("NOTE: Phase D not ready — need ≥4 runs, avg internal edits ≤2, public-only ≥75%");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
