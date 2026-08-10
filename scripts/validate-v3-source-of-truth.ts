/**
 * V3 Source-of-Truth Architecture Gate
 *
 * Scans packages/, apps/, and scripts/ for forbidden V2 patterns.
 * Fails the build if any production code contains V2 references.
 *
 * Usage: pnpm --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
 *
 * Allowed in:
 *   - docs/ (archived docs about the migration)
 *   - scripts/validate-v3-source-of-truth.ts (this file)
 *   - packages/motion-protocol/src/legacy/ (internal shared schemas)
 *   - compile-v3.ts (Phase 4 pending — V3 direct compiler not yet complete)
 *   - Runtime IR goldens (formatVersion: 2 is runtime IR, not authoring)
 *   - Editor-core internal migration helpers (compatibility with legacy data)
 *   - AI planner comments referencing the phase transition
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Forbidden patterns ────────────────────────────────────────────────

const FORBIDDEN = [
  // V2 type names (production only)
  { pattern: /\bMotionProjectV2\b/, label: "MotionProjectV2" },
  {
    pattern: /\bNormalizedMotionProjectV2\b/,
    label: "NormalizedMotionProjectV2",
  },
  // V2 parser/compiler
  { pattern: /\bparseMotionProjectV2\b/, label: "parseMotionProjectV2" },
  { pattern: /\bparseMotionComponentV2\b/, label: "parseMotionComponentV2" },
  {
    pattern: /\bserializeMotionProjectV2\b/,
    label: "serializeMotionProjectV2",
  },
  { pattern: /\bcompileMotionProjectV2\b/, label: "compileMotionProjectV2" },
  // V2 migration
  {
    pattern: /\bmigrateMotionProjectV2ToV3\b/,
    label: "migrateMotionProjectV2ToV3",
  },
  // V2 timeline model in production code
  { pattern: /\btimeline\.sceneOrder\b/, label: "timeline.sceneOrder" },
  { pattern: /\bscene\.transition\b/, label: "scene.transition" },
  // V2 fixture paths
  { pattern: /__fixtures__\/v2/, label: "__fixtures__/v2" },
  { pattern: /__fixtures__\*\*\\v2/, label: "__fixtures__\\v2 (Windows)" },
  // V2 format version in authoring JSON (not runtime IR)
  { pattern: /"formatVersion"\s*:\s*2/, label: '"formatVersion": 2' },
];

// ── Allowlist ─────────────────────────────────────────────────────────

const ALLOWLIST = [
  // The plan document itself
  /docs[\\/]remove-v2-keep-v3-source-of-truth-plan\.md$/,
  // This script
  /scripts[\\/]validate-v3-source-of-truth\.ts$/,
  // V2 compatibility layer — parse, component, patch, project, references
  /packages[\\/]motion-protocol[\\/]src[\\/]compat[\\/]/,
  // Protocol root barrel — comment block documents excluded V2 types
  /packages[\\/]motion-protocol[\\/]src[\\/]index\.ts$/,
  // Runtime re-exports from legacy — Phase 2: forward-looking aliases
  /packages[\\/]motion-protocol[\\/]src[\\/]runtime[\\/]/,
  // Phase 4 pending: V3 compiler still uses internal V2 pipeline (downMigration)
  /packages[\\/]motion-compiler[\\/]src[\\/]compile-v3\.ts$/,
  /packages[\\/]motion-compiler[\\/]src[\\/]index\.ts$/,
  /packages[\\/]motion-compiler[\\/]src[\\/]compile-cache\.ts$/,
  /packages[\\/]motion-compiler[\\/]src[\\/]__tests__[\\/]compile-v3\.test\.ts$/,
  // Protocol tests — reference legacy parser for isolation/migration tests
  /packages[\\/]motion-protocol[\\/]src[\\/]capabilities\.test\.ts$/,
  /packages[\\/]motion-protocol[\\/]src[\\/]ai-schema-capability\.test\.ts$/,
  /packages[\\/]motion-protocol[\\/]src[\\/]v3[\\/]__tests__[\\/]schema\.test\.ts$/,
  // Runtime IR goldens use formatVersion: 2 (runtime format, not authoring)
  /runtime-compile-goldens[\\/].*\.runtime\.json$/,
  // Editor-core internal migration helpers — transitional compatibility
  /packages[\\/]editor-core[\\/]src[\\/]timeline[\\/]internal[\\/]timeline-project-sync\.ts$/,
  /packages[\\/]editor-core[\\/]src[\\/]timeline[\\/]selectors[\\/]scene-order-clips\.ts$/,
  /packages[\\/]editor-core[\\/]src[\\/]timeline[\\/]migrations[\\/]project-migration\.ts$/,
  // AI planner executor — comments mention the transition
  /packages[\\/]ai-planner[\\/]src[\\/]commands[\\/]executor\.ts$/,
  // Motion-runtime — Phase 5 legacy fallback paths (still have sceneOrder/transition refs)
  /packages[\\/]motion-runtime[\\/]src[\\/]evaluate-composition\.ts$/,
  /packages[\\/]motion-runtime[\\/]src[\\/]resolve-timeline\.ts$/,
  /packages[\\/]motion-runtime[\\/]src[\\/]composition[\\/]evaluate-composition-layers\.ts$/,
  /packages[\\/]motion-runtime[\\/]src[\\/]composition[\\/]transition-fixtures\.ts$/,
  /packages[\\/]motion-runtime[\\/]src[\\/]testing[\\/]compile\.ts$/,
  /packages[\\/]motion-runtime[\\/]src[\\/]__tests__[\\/]/,
  // Motion-runtime README
  /packages[\\/]motion-runtime[\\/]README\.md$/,
  // Package READMEs that document the v2→v3 migration
  /packages[\\/]motion-protocol[\\/]README\.md$/,
  /packages[\\/]motion-compiler[\\/]README\.md$/,
  /clipkit[\\/]README\.md$/,
  /clipkit[\\/]PROTOCOL\.md$/,
  // Architecture docs
  /docs[\\/]/,
  // Desktop smoke test probe
  /apps[\\/]desktop[\\/]electron[\\/]main[\\/]services[\\/]journal-worker-smoke[\\/]/,
  // Render worker frame-plan — legacy fallback for older compiled projects
  /apps[\\/]render-worker[\\/]src[\\/]runtime[\\/]frame-plan\.ts$/,
  // Desktop export service references docs/fixtures path
  /apps[\\/]desktop[\\/]electron[\\/]main[\\/]services[\\/]export[\\/]export\.service\.ts$/,
  // Web vite-phase0 fixtures — generated golden data
  /apps[\\/]web[\\/]lib[\\/]editor[\\/]__fixtures__[\\/]vite-phase0\.ts$/,
  // Acceptance and validation scripts — work with fixtures
  /scripts[\\/]score-acceptance-pack\.ts$/,
  /scripts[\\/]validate-acceptance-export\.ts$/,
  /scripts[\\/]validate-acceptance-web-parity\.ts$/,
  /scripts[\\/]validate-runtime-primitives\.ts$/,
];

// ── Scan directories ──────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  pattern: string;
  text: string;
}

function shouldSkip(filePath: string): boolean {
  const rel = relative(ROOT, filePath).replace(/\\/g, "/");
  return ALLOWLIST.some((re) => re.test(rel));
}

function* walkDir(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === ".next" ||
        entry.name.startsWith("dist-")
      )
        continue;
      yield* walkDir(full);
    } else if (entry.isFile()) {
      const ext = entry.name.split(".").pop()?.toLowerCase();
      if (
        ext === "ts" ||
        ext === "tsx" ||
        ext === "js" ||
        ext === "mjs" ||
        ext === "json" ||
        ext === "md"
      ) {
        yield full;
      }
    }
  }
}

function scanFile(filePath: string): Violation[] {
  if (shouldSkip(filePath)) return [];

  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const violations: Violation[] = [];

  for (const rule of FORBIDDEN) {
    // For JSON files, only check formatVersion:2
    if (filePath.endsWith(".json") && rule.label !== '"formatVersion": 2')
      continue;

    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i]!)) {
        violations.push({
          file: relative(ROOT, filePath),
          line: i + 1,
          pattern: rule.label,
          text: lines[i]!.trim().slice(0, 120),
        });
      }
    }
  }

  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────

function main(): void {
  const allViolations: Violation[] = [];

  const scanRoots = [
    resolve(ROOT, "packages"),
    resolve(ROOT, "apps"),
    resolve(ROOT, "scripts"),
    resolve(ROOT, "docs"),
  ];

  for (const root of scanRoots) {
    for (const file of walkDir(root)) {
      allViolations.push(...scanFile(file));
    }
  }

  if (allViolations.length === 0) {
    console.log(
      "✅ V3 source-of-truth gate passed — no forbidden V2 patterns found.",
    );
    process.exit(0);
  }

  console.error(
    `❌ V3 source-of-truth gate FAILED — ${allViolations.length} violation(s):\n`,
  );
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  [${v.pattern}]`);
    console.error(`    ${v.text}\n`);
  }

  console.error("These patterns indicate V2 references in production code.");
  console.error(
    "Remove them or add the file to the ALLOWLIST in scripts/validate-v3-source-of-truth.ts.",
  );
  process.exit(1);
}

main();
