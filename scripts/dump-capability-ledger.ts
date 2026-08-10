/**
 * Dump capability ledger → docs/capability-ledger.md + JSON artifact.
 *
 * Usage: npx tsx scripts/dump-capability-ledger.ts
 */

import {
  CAPABILITY_LEDGER,
  CAPABILITY_MANIFEST_VERSION,
  type CapabilityRow,
  type CapabilityColumn,
  type CapabilityStatus,
} from "../packages/motion-runtime/src/capability-ledger";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");

// ── Known gaps (keep in sync with inventory) ─────────────────────────

const KNOWN_GAPS: string[] = [
  "Pixi video texture: static-texture only, no HTMLVideoElement/rVFC seek/decode",
  "Pixi mask/offscreen: no RenderTexture compositing pipeline",
  "Remotion audio: AudioRenderPlan exists, <Audio> wiring not connected",
  "Prepared indexes: compiler builds Map locally, not exported in artifact",
  "Structured diagnostics: compiler throws strings, no path/sourceRef diagnostics",
  "Compile cache: no memoization or invalidation",
  "Playback engine: RAF-based clock in editor-core, no AudioContext master clock",
  "Projection union: no 2D/2.5D/3D geometry abstraction seam",
];

// ── Markdown ──────────────────────────────────────────────────────────

function statusEmoji(s: CapabilityStatus): string {
  switch (s) {
    case "yes":
      return "✅";
    case "partial":
      return "🟡";
    case "no":
      return "❌";
    case "planned":
      return "📋";
  }
}

const COLUMNS: CapabilityColumn[] = [
  "schema",
  "command",
  "compiler",
  "evaluator",
  "pixi",
  "remotion",
  "worker",
  "parity",
  "editor",
];

function columnLabel(c: CapabilityColumn): string {
  const map: Record<CapabilityColumn, string> = {
    schema: "Schema",
    command: "Command",
    compiler: "Compiler",
    evaluator: "Evaluator",
    pixi: "Pixi",
    remotion: "Remotion",
    worker: "Worker",
    parity: "Parity",
    editor: "Editor",
  };
  return map[c] ?? c;
}

function rowMarkdown(row: CapabilityRow): string {
  const cells = COLUMNS.map((c) => `${statusEmoji(row.columns[c])} ${row.columns[c]}`).join(" | ");
  const notes = row.notes ? ` | ${row.notes}` : " | —";
  return `| ${row.id} | ${row.label} | ${cells}${notes} |`;
}

function generateMarkdown(): string {
  const header = COLUMNS.map(columnLabel).join(" | ");
  const divider = COLUMNS.map(() => "---").join(" | ");

  const rows = CAPABILITY_LEDGER.map(rowMarkdown).join("\n");

  const gaps = KNOWN_GAPS.map((g) => `- ❌ ${g}`).join("\n");

  return [
    `# Capability Ledger`,
    ``,
    `> Manifest version: **${CAPABILITY_MANIFEST_VERSION}**`,
    `> Generated: ${new Date().toISOString()}`,
    `> Columns: schema → compiler → evaluator → pixi → remotion → worker → parity → editor`,
    ``,
    `## Capability Matrix`,
    ``,
    `| Capability ID | Label | ${header} | Notes |`,
    `|---|---|${divider}|---|`,
    rows,
    ``,
    `## Known Gaps`,
    ``,
    gaps,
    ``,
    `## Legend`,
    ``,
    `- ✅ \`yes\` — fully implemented and tested`,
    `- 🟡 \`partial\` — partial support, no production guarantee`,
    `- ❌ \`no\` — not implemented`,
    `- 📋 \`planned\` — on roadmap, not started`,
    ``,
  ].join("\n");
}

// ── JSON artifact ─────────────────────────────────────────────────────

function generateJson(): unknown {
  return {
    manifestVersion: CAPABILITY_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    columns: COLUMNS,
    rows: CAPABILITY_LEDGER.map((r) => ({
      id: r.id,
      label: r.label,
      ...r.columns,
      notes: r.notes ?? null,
    })),
    knownGaps: KNOWN_GAPS,
  };
}

// ── Main ──────────────────────────────────────────────────────────────

const docsDir = path.join(ROOT, "docs");
fs.mkdirSync(docsDir, { recursive: true });

// Markdown
fs.writeFileSync(path.join(docsDir, "capability-ledger.md"), generateMarkdown(), "utf8");
console.log("✅ Wrote docs/capability-ledger.md");

// JSON
fs.writeFileSync(
  path.join(docsDir, "capability-ledger.json"),
  JSON.stringify(generateJson(), null, 2),
  "utf8",
);
console.log("✅ Wrote docs/capability-ledger.json");

// Print summary
console.log(`\n${CAPABILITY_LEDGER.length} capabilities | ${KNOWN_GAPS.length} known gaps`);
