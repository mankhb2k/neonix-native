/**
 * V3 Source-of-Truth Architecture Gate
 *
 * Scans packages/, apps/, scripts/ for forbidden V2 patterns.
 * Fails the build if any production code contains V2 references.
 *
 * Usage: tsx scripts/validate-v3-source-of-truth.ts
 *
 * Allowed in:
 *   - scripts/validate-v3-source-of-truth.ts (this file)
 *   - packages/motion-protocol/src/runtime/ (runtime IR format, not V2 authoring)
 *   - packages/motion-protocol/src/index.ts (comment block documents excluded V2 types)
 *   - packages/motion-compiler/src/index.ts (legacy V2 compiler path, internal only)
 *   - packages/motion-compiler/src/compile-v3.ts (runtime IR formatVersion:2)
 *   - packages/motion-runtime/src/composition/ (runtime IR field scene.transition)
 *   - READMEs / docs documenting the migration
 *   - Test files exercising isolation or negative assertions
 *
 * Phase 7 (compat-removal): compat/ deleted, gate tightened.
 *   Added hard directory existence check for compat/.
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
  { pattern: /__fixtures__\\v2/, label: "__fixtures__\\v2 (Windows)" },
  // Phase 13: removed migration code
  { pattern: /\bdownMigrate\b/, label: "downMigrate" },
  // Phase 13: compat imports outside the compat directory itself
  {
    pattern: /from\s+["']\.\.?\/compat\//,
    label: "from ./compat or ../compat",
  },
  // Phase 8: compat/ must not appear in package.json exports
  {
    pattern: /"\.\/compat/,
    label: '"./compat" in package.json exports',
  },
  // Phase 9: no V2-prefixed schema names in production code
  {
    pattern: /\b\w+V2Schema\b/,
    label: "*V2Schema name in production",
  },
  // Phase 2 (v3-residue): V2-named constants must not exist
  {
    pattern: /MOTION_V2_LIMITS/,
    label: "MOTION_V2_LIMITS (use MOTION_PROTOCOL_LIMITS)",
  },
];

// ── Allowlist (tightened Phase 13) ───────────────────────────────────

const ALLOWLIST = [
  // The plan documents
  /docs[\\/]remove-v2-keep-v3-source-of-truth-plan\.md$/,
  /docs[\\/]motion-project-v3-refactor-plan\.md$/,
  /docs[\\/]v3-source-of-truth-completion-plan\.md$/,
  /docs[\\/]remove-compat-completely-plan\.md$/,
  // This script
  /scripts[\\/]validate-v3-source-of-truth\.ts$/,
  // Protocol root barrel — comment block documents excluded V2 types
  /packages[\\/]motion-protocol[\\/]src[\\/]index\.ts$/,
  // Runtime re-exports — runtime IR format, not V2 authoring
  /packages[\\/]motion-protocol[\\/]src[\\/]runtime[\\/]/,
  // V3 canonical definitions — defines V2-prefixed primitives for backward compat
  /packages[\\/]motion-protocol[\\/]src[\\/]v3[\\/]/,
  // Protocol test verifying ./compat is removed from exports (Phase 7-8 gate)
  /packages[\\/]motion-protocol[\\/]src[\\/]__tests__[\\/]schema-files\.test\.ts$/,
  // Protocol test: root API V2 regression guard (Phase 4) — lists forbidden strings
  /packages[\\/]motion-protocol[\\/]src[\\/]__tests__[\\/]root-api-v2-regression\.test\.ts$/,
  // V3 schema tests — negative tests verifying scene.transition is absent from V3 scenes
  /packages[\\/]motion-protocol[\\/]src[\\/]v3[\\/]__tests__[\\/]schema\.test\.ts$/,
  // Compiler: legacy v2 path (index.ts) + sceneOrder in test assertions
  /packages[\\/]motion-compiler[\\/]src[\\/]index\.ts$/,
  /packages[\\/]motion-compiler[\\/]src[\\/]__tests__[\\/]compile-v3\.test\.ts$/,
  // Compiler: V3 pipeline passes scene.transition=undefined to legacy _compileScenePipeline
  /packages[\\/]motion-compiler[\\/]src[\\/]compile-v3\.ts$/,
  // Runtime IR goldens use formatVersion: 3 (Phase 6 bump)
  /runtime-compile-goldens[\\/].*\.runtime\.json$/,
  // Motion-runtime: scene.transition is runtime IR field, not V2 authoring
  /packages[\\/]motion-runtime[\\/]src[\\/]composition[\\/]evaluate-composition-layers\.ts$/,
  /packages[\\/]motion-runtime[\\/]src[\\/]composition[\\/]transition-fixtures\.ts$/,
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
  // Desktop export service references docs/fixtures path
  /apps[\\/]desktop[\\/]electron[\\/]main[\\/]services[\\/]export[\\/]export\.service\.ts$/,
  // Web vite-phase0 fixtures — generated golden data
  /apps[\\/]web[\\/]lib[\\/]editor[\\/]__fixtures__[\\/]vite-phase0\.ts$/,
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
        entry.name === "dist-renderer" ||
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
  ];

  for (const root of scanRoots) {
    for (const file of walkDir(root)) {
      allViolations.push(...scanFile(file));
    }
  }

  // ── Hard gate: compat/ folder must not exist ──────────────────────

  if (
    existsSync(resolve(ROOT, "packages", "motion-protocol", "src", "compat"))
  ) {
    allViolations.push({
      file: "packages/motion-protocol/src/compat/",
      line: 0,
      pattern: "compat-directory",
      text: "compat/ folder still exists — must be deleted",
    });
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
