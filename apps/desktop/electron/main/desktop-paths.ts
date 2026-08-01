/**
 * Stable app / renderer / repo roots for esbuild-bundled main.
 *
 * Never infer roots from `__dirname` depth — the bundle lives at `dist/main/index.js`
 * so relative `../../..` walks escape the package.
 */

import fs from "node:fs";
import path from "node:path";

export type DesktopPathsInput = {
  /** `app.getAppPath()` — asar root when packaged, `apps/desktop` when unpackaged. */
  appPath: string;
  /** `process.resourcesPath` when packaged (extraResources). */
  resourcesPath?: string;
  packaged: boolean;
  /** Optional override for tests. */
  existsSync?: (p: string) => boolean;
};

export type DesktopPaths = {
  appRoot: string;
  rendererRoot: string;
  repoRoot: string;
  resourcesRoot: string;
};

function fileExists(p: string, existsSync: (p: string) => boolean): boolean {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Unpackaged: appPath is typically `.../apps/desktop` (package.json + electron entry).
 * Packaged: appPath is the asar / app directory containing package.json + dist-renderer.
 */
export function resolveDesktopPaths(input: DesktopPathsInput): DesktopPaths {
  const exists = input.existsSync ?? fs.existsSync;
  const appRoot = path.resolve(input.appPath);

  if (input.packaged) {
    const resourcesRoot = path.resolve(
      input.resourcesPath ?? path.join(appRoot, ".."),
    );
    return {
      appRoot,
      rendererRoot: path.join(appRoot, "dist-renderer"),
      // Packaged export uses resourcesRoot as worker root (see export-service).
      repoRoot: resourcesRoot,
      resourcesRoot,
    };
  }

  const rendererRoot = path.join(appRoot, "dist-renderer");
  // Monorepo: apps/desktop → repo root is two levels up.
  let repoRoot = path.resolve(appRoot, "../..");

  // Prefer a layout that actually contains render-worker (dev export).
  const candidate = path.join(repoRoot, "apps", "render-worker");
  if (!fileExists(candidate, exists)) {
    const alt = path.resolve(appRoot, "../../..");
    if (fileExists(path.join(alt, "apps", "render-worker"), exists)) {
      repoRoot = alt;
    }
  }

  return {
    appRoot,
    rendererRoot,
    repoRoot,
    resourcesRoot: appRoot,
  };
}
