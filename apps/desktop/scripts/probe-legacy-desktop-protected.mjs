/**
 * Fail if any protected legacy desktop file is missing from the filesystem,
 * or if the working tree/index deletes paths under apps/web/components/desktop/**.
 *
 * CSS-0: manifest catches deletions already committed (git diff HEAD is empty on CI).
 *
 * Run: node scripts/probe-legacy-desktop-protected.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PROTECTED = "apps/web/components/desktop/";
const MANIFEST = join(
  repoRoot,
  "docs/migration/vite-ui/legacy-desktop-protected-files.json",
);

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Paths deleted in staged + unstaged vs HEAD. */
function deletedPaths() {
  const out = new Set();
  for (const args of [
    ["diff", "--cached", "--name-only", "--diff-filter=D"],
    ["diff", "--name-only", "--diff-filter=D"],
    ["diff", "HEAD", "--name-only", "--diff-filter=D"],
  ]) {
    try {
      const staged = git(args);
      for (const line of staged.split(/\r?\n/)) {
        if (line) out.add(line.replaceAll("\\", "/"));
      }
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

let failed = 0;

if (!existsSync(MANIFEST)) {
  console.error(
    "[probe-legacy-desktop-protected] FAIL — missing manifest:",
    MANIFEST,
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const files = Array.isArray(manifest.files) ? manifest.files : [];
if (!files.length) {
  console.error("[probe-legacy-desktop-protected] FAIL — manifest has no files");
  process.exit(1);
}

const missing = [];
for (const rel of files) {
  const normalized = String(rel).replaceAll("\\", "/");
  if (!existsSync(join(repoRoot, normalized))) missing.push(normalized);
}

if (missing.length) {
  console.error(
    `[probe-legacy-desktop-protected] FAIL — ${missing.length}/${files.length} protected file(s) missing from filesystem:`,
  );
  for (const p of missing.slice(0, 40)) console.error("  -", p);
  if (missing.length > 40) console.error(`  … +${missing.length - 40} more`);
  failed += 1;
}

const hits = deletedPaths().filter(
  (p) => p === PROTECTED.slice(0, -1) || p.startsWith(PROTECTED),
);

if (hits.length) {
  console.error(
    "[probe-legacy-desktop-protected] FAIL — working-tree deletions under apps/web/components/desktop/**:",
  );
  for (const p of hits) console.error("  -", p);
  failed += 1;
}

if (failed) {
  console.error(
    "Note: FREEZE.md “delete this tree” is stale; see docs/migration/vite-ui/N8_QA_CUTOVER.md.",
  );
  process.exit(1);
}

console.log(
  `[probe-legacy-desktop-protected] ok — ${files.length} files present; no working-tree deletions`,
);
