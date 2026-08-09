/**
 * Architecture dependency guard — prevents core packages from importing
 * renderer or app packages.
 *
 * Rule:
 *   core → core ✅
 *   core → renderer ❌
 *   core → app ❌
 *   renderer → core ✅
 *   app → anything ✅
 *
 * Usage: pnpm --filter @motionvideo/render-worker exec tsx ../../scripts/validate-arch-deps.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Package classification ───────────────────────────────────────────

interface PkgMeta {
  name: string;
  dir: string;
  deps: Record<string, string>;
  devDeps: Record<string, string>;
  peerDeps: Record<string, string>;
}

function readPkg(pkgDir: string): PkgMeta {
  const raw = JSON.parse(
    readFileSync(resolve(pkgDir, "package.json"), "utf8"),
  ) as {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  return {
    name: raw.name ?? resolve(pkgDir),
    dir: pkgDir,
    deps: raw.dependencies ?? {},
    devDeps: raw.devDependencies ?? {},
    peerDeps: raw.peerDependencies ?? {},
  };
}

function workspacePackages(root: string): PkgMeta[] {
  const pkgs: PkgMeta[] = [];
  const appsDir = resolve(root, "apps");
  const pkgsDir = resolve(root, "packages");

  if (existsSync(appsDir)) {
    for (const child of readdirSync(appsDir, { withFileTypes: true })) {
      if (
        child.isDirectory() &&
        existsSync(resolve(appsDir, child.name, "package.json"))
      ) {
        pkgs.push(readPkg(resolve(appsDir, child.name)));
      }
    }
  }

  if (existsSync(pkgsDir)) {
    for (const child of readdirSync(pkgsDir, { withFileTypes: true })) {
      if (
        child.isDirectory() &&
        existsSync(resolve(pkgsDir, child.name, "package.json"))
      ) {
        pkgs.push(readPkg(resolve(pkgsDir, child.name)));
      }
    }
  }

  return pkgs;
}

// ── Classification by package name suffix ────────────────────────────

const CORE_PACKAGES = new Set([
  "@motionvideo/motion-schema",
  "@motionvideo/motion-compiler",
  "@motionvideo/motion-runtime",
  "@motionvideo/editor-core",
  "@motionvideo/editor-interactions",
  "@motionvideo/render-contracts",
]);

const RENDERER_PACKAGES = new Set([
  "@motionvideo/pixi-renderer",
  "@motionvideo/remotion-renderer",
]);

const APP_PACKAGES = new Set([
  "@motionvideo/web",
  "@motionvideo/desktop",
  "@motionvideo/render-worker",
  "@motionvideo/remotion-site",
]);

// ── Forbidden rule ────────────────────────────────────────────────────

const FORBIDDEN_SOURCES = [
  {
    sources: CORE_PACKAGES,
    targets: RENDERER_PACKAGES,
    label: "core → renderer",
  },
  { sources: CORE_PACKAGES, targets: APP_PACKAGES, label: "core → app" },
];

// ── Check package.json dependencies only ──────────────────────────────

interface Violation {
  source: string;
  target: string;
  kind: "dependency" | "devDependency" | "peerDependency";
  rule: string;
}

function checkDeps(pkgs: PkgMeta[]): Violation[] {
  const byName = new Map(pkgs.map((p) => [p.name, p]));
  const violations: Violation[] = [];

  for (const rule of FORBIDDEN_SOURCES) {
    for (const sourceName of rule.sources) {
      const pkg = byName.get(sourceName);
      if (!pkg) continue;

      const allDeps = [
        ...Object.keys(pkg.deps).map((k) => ({
          name: k,
          kind: "dependency" as const,
        })),
        ...Object.keys(pkg.devDeps).map((k) => ({
          name: k,
          kind: "devDependency" as const,
        })),
        ...Object.keys(pkg.peerDeps).map((k) => ({
          name: k,
          kind: "peerDependency" as const,
        })),
      ];

      for (const dep of allDeps) {
        if (rule.targets.has(dep.name)) {
          violations.push({
            source: sourceName,
            target: dep.name,
            kind: dep.kind,
            rule: rule.label,
          });
        }
      }
    }
  }

  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────

const pkgs = workspacePackages(ROOT);
const violations = checkDeps(pkgs);

if (violations.length > 0) {
  console.error(`❌ ${violations.length} architecture violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.source} → ${v.target} (${v.kind})  [${v.rule}]`);
  }
  console.error(`\nCore packages must not depend on renderer or app packages.`);
  process.exit(1);
}

console.log(`✅ Architecture clean — ${pkgs.length} packages, 0 violations`);
process.exit(0);
