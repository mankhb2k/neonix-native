/**
 * V1 Source-of-Truth Architecture Gate
 *
 * Scans packages/, apps/, scripts/ for forbidden V2 patterns.
 * Fails the build if any production code contains V2 references.
 *
 * Usage: tsx scripts/validate-v1-source-of-truth.ts
 *
 * Phase 6: gate tightened. Removed compile-v1.ts ALLOWLIST (now scene.transition-free).
 *   Added hard checks for removed aliases (MotionRuntimeIR, NodeTimingV2, etc.)
 *   and legacy/ directory existence.
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
  // V2 parser
  { pattern: /\bparseMotionProjectV2\b/, label: "parseMotionProjectV2" },
  { pattern: /\bparseMotionComponentV2\b/, label: "parseMotionComponentV2" },
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
  { pattern: /docs\/fixtures\/v2/, label: "docs/fixtures/v2" },
  { pattern: /docs\\fixtures\\v2/, label: "docs\\fixtures\\v2 (Windows)" },
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
  // Final polish: no generic V2-suffixed identifiers in production code.
  {
    pattern: /\b[A-Za-z0-9_]+V2\b/,
    label: "*V2 identifier in production",
  },
  // Phase 2 (v1-residue): V2-named constants must not exist
  {
    pattern: /MOTION_V2_LIMITS/,
    label: "MOTION_V2_LIMITS (use MOTION_PROTOCOL_LIMITS)",
  },
  // Phase 1 (final-source-of-truth): removed deprecated aliases
  { pattern: /\bMotionRuntimeIR\b/, label: "MotionRuntimeIR (removed alias)" },
  { pattern: /\bNodeTimingV2\b/, label: "NodeTimingV2 (removed alias)" },
  {
    pattern: /\bProceduralDriverV2\b/,
    label: "ProceduralDriverV2 (removed alias)",
  },
  {
    pattern: /\bRuntimeDiagnosticV2\b/,
    label: "RuntimeDiagnosticV2 (removed alias)",
  },
  {
    pattern: /\bNormalizedMotionProjectSchema\b/,
    label: "NormalizedMotionProjectSchema (removed alias)",
  },
  // Phase 2 (final-source-of-truth): no legacy import paths
  { pattern: /src[\/]legacy/, label: "src/legacy path reference" },
  // Phase 4 (native-source-of-truth): production mental-model leaks
  {
    pattern: /Authoring IR v2/,
    label: "Authoring IR v2 (use V1-native language)",
  },
  {
    pattern: /\bV2-shaped\b/,
    label: "V2-shaped (use 'runtime-ready' or 'normalized')",
  },
  {
    pattern: /down-migration\b/,
    label: "down-migration (use 'runtime preparation' or 'compilation')",
  },
  // Phase 6 (final-source-of-truth): removed legacy comment patterns
  {
    pattern: /legacy re-exports/i,
    label: "'legacy re-exports' language (use neutral phrasing)",
  },
  {
    pattern: /re-exported for compat/i,
    label: "'re-exported for compat' language (use neutral phrasing)",
  },
  {
    pattern: /V2 backward-compat schemas/i,
    label: "'V2 backward-compat schemas' language (use neutral phrasing)",
  },
  {
    pattern: /\bV2-specific\b/i,
    label:
      "'V2-specific' language (use 'runtime' or 'authoring' as appropriate)",
  },
  {
    pattern: /\bcomponent-action\b/i,
    label: "'component-action' (removed V2 concept)",
  },
];

// ── Allowlist (tightened Phase 13) ───────────────────────────────────

const ALLOWLIST = [
  // The plan documents
  /docs[\\/]remove-v2-keep-v1-source-of-truth-plan\.md$/,
  /docs[\\/]motion-project-v1-refactor-plan\.md$/,
  /docs[\\/]v1-source-of-truth-completion-plan\.md$/,
  /docs[\\/]remove-compat-completely-plan\.md$/,
  // This script
  /scripts[\\/]validate-v1-source-of-truth\.ts$/,
  // Protocol tests: intentional negative tests + regression guards
  /packages[\\/]motion-protocol[\\/]src[\\/]__tests__[\\/]schema-files\.test\.ts$/,
  /packages[\\/]motion-protocol[\\/]src[\\/]__tests__[\\/]root-api-v2-regression\.test\.ts$/,
  // V1 schema negative tests — verifying scene.transition absence
  /packages[\\/]motion-protocol[\\/]src[\\/]v3[\\/]__tests__[\\/]schema\.test\.ts$/,
  /packages[\\/]motion-protocol[\\/]src[\\/]v3[\\/]__tests__[\\/]skills\.test\.ts$/,
  /packages[\\/]motion-protocol[\\/]src[\\/]v3[\\/]__tests__[\\/]mcp\.test\.ts$/,
  // V1 validation modules: scene.transition in diagnostic/error messages
  /packages[\\/]motion-protocol[\\/]src[\\/]v3[\\/]skills\.ts$/,
  /packages[\\/]motion-protocol[\\/]src[\\/]v3[\\/]mcp\.ts$/,
  // Compiler: V1 test asserting NO scene.transition on compiled scenes (negative test)
  /packages[\\/]motion-compiler[\\/]src[\\/]__tests__[\\/]compile-v1\.test\.ts$/,
  // Runtime IR goldens (Phase 6)
  /runtime-compile-goldens[\\/].*\.runtime\.json$/,
  // Motion-runtime tests
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

  // ── Hard gate: legacy/ folder must not exist ─────────────────────

  if (
    existsSync(resolve(ROOT, "packages", "motion-protocol", "src", "legacy"))
  ) {
    allViolations.push({
      file: "packages/motion-protocol/src/legacy/",
      line: 0,
      pattern: "legacy-directory",
      text: "legacy/ folder still exists — must be deleted",
    });
  }

  if (allViolations.length === 0) {
    console.log(
      "✅ V1 source-of-truth gate passed — no forbidden V2 patterns found.",
    );
    process.exit(0);
  }

  console.error(
    `❌ V1 source-of-truth gate FAILED — ${allViolations.length} violation(s):\n`,
  );
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  [${v.pattern}]`);
    console.error(`    ${v.text}\n`);
  }

  console.error("These patterns indicate V2 references in production code.");
  console.error(
    "Remove them or add the file to the ALLOWLIST in scripts/validate-v1-source-of-truth.ts.",
  );
  process.exit(1);
}

main();
