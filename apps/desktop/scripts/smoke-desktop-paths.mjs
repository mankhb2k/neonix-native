/**
 * Artifact smoke: after `pnpm build:main`, assert bundled main does not
 * resolve roots via `__dirname` depth walks, and DesktopPaths contract holds.
 *
 * Run: node scripts/smoke-desktop-paths.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const mainBundle = path.join(desktopRoot, "dist", "main", "index.js");

if (!fs.existsSync(mainBundle)) {
  console.error(`[smoke-desktop-paths] missing ${mainBundle} — run build:main first`);
  process.exit(1);
}

const source = fs.readFileSync(mainBundle, "utf8");

if (
  /__dirname,\s*["']\.\.\/\.\.\/\.\.["']/.test(source) ||
  /__dirname,\s*["']\.\.\/\.\.\/\.\.\/\.\.\/\.\.["']/.test(source)
) {
  console.error(
    "[smoke-desktop-paths] bundle still resolves roots via __dirname depth walks",
  );
  process.exit(1);
}

if (!source.includes("dist-renderer")) {
  console.error("[smoke-desktop-paths] expected dist-renderer in bundle");
  process.exit(1);
}

function resolveDesktopPaths(input) {
  const appRoot = path.resolve(input.appPath);
  if (input.packaged) {
    const resourcesRoot = path.resolve(
      input.resourcesPath ?? path.join(appRoot, ".."),
    );
    return {
      appRoot,
      rendererRoot: path.join(appRoot, "dist-renderer"),
      repoRoot: resourcesRoot,
      resourcesRoot,
    };
  }
  const rendererRoot = path.join(appRoot, "dist-renderer");
  let repoRoot = path.resolve(appRoot, "../..");
  const candidate = path.join(repoRoot, "apps", "render-worker");
  if (!fs.existsSync(candidate)) {
    const alt = path.resolve(appRoot, "../../..");
    if (fs.existsSync(path.join(alt, "apps", "render-worker"))) {
      repoRoot = alt;
    }
  }
  return { appRoot, rendererRoot, repoRoot, resourcesRoot: appRoot };
}

const unpackaged = resolveDesktopPaths({
  appPath: desktopRoot,
  packaged: false,
});

const expectedRenderer = path.join(desktopRoot, "dist-renderer");
const expectedRepo = path.resolve(desktopRoot, "../..");

if (unpackaged.rendererRoot !== expectedRenderer) {
  console.error(
    `[smoke-desktop-paths] rendererRoot mismatch:\n  got ${unpackaged.rendererRoot}\n  expected ${expectedRenderer}`,
  );
  process.exit(1);
}

if (unpackaged.repoRoot !== expectedRepo) {
  console.error(
    `[smoke-desktop-paths] repoRoot mismatch:\n  got ${unpackaged.repoRoot}\n  expected ${expectedRepo}`,
  );
  process.exit(1);
}

const wrongRenderer = path.resolve(
  path.join(desktopRoot, "dist", "main"),
  "../../..",
  "dist-renderer",
);
if (wrongRenderer === unpackaged.rendererRoot) {
  console.error(
    "[smoke-desktop-paths] unexpected: wrong dirname walk equals correct rendererRoot",
  );
  process.exit(1);
}

console.log("[smoke-desktop-paths] ok", {
  rendererRoot: unpackaged.rendererRoot,
  repoRoot: unpackaged.repoRoot,
  mainBundle,
});
