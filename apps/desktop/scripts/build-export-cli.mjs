/**
 * Bundle render-worker cli-export for packaged Electron (no tsx).
 * Output: resources/export-cli/cli-export.cjs + native deps.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const outDir = path.join(desktopRoot, "resources", "export-cli");
const outfile = path.join(outDir, "cli-export.cjs");
const entry = path.join(
  repoRoot,
  "apps",
  "render-worker",
  "src",
  "cli-export.ts",
);

const require = createRequire(
  path.join(repoRoot, "apps", "render-worker", "package.json"),
);

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyPackageTree(pkgName) {
  const src = path.dirname(
    require.resolve(`${pkgName}/package.json`, {
      paths: [path.join(repoRoot, "apps", "render-worker"), repoRoot],
    }),
  );
  const dest = path.join(outDir, "node_modules", pkgName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  rimraf(dest);
  fs.cpSync(src, dest, { recursive: true });
  return dest;
}

const frameWorkerEntry = path.join(
  repoRoot,
  "apps",
  "render-worker",
  "src",
  "runtime",
  "frame-worker.ts",
);

fs.mkdirSync(outDir, { recursive: true });

const sharedBuild = {
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["@napi-rs/canvas", "ffmpeg-static"],
  packages: "bundle",
  logLevel: "info",
  banner: {
    js: 'var import_meta_url = require("node:url").pathToFileURL(__filename).href;',
  },
  define: {
    "import.meta.url": "import_meta_url",
  },
};

await esbuild.build({
  ...sharedBuild,
  entryPoints: [entry],
  outfile,
});

await esbuild.build({
  ...sharedBuild,
  entryPoints: [frameWorkerEntry],
  outfile: path.join(outDir, "frame-worker.cjs"),
});

copyPackageTree("@napi-rs/canvas");
copyPackageTree("ffmpeg-static");

fs.writeFileSync(
  path.join(outDir, "package.json"),
  JSON.stringify(
    {
      name: "motionvideo-export-cli",
      private: true,
      type: "commonjs",
      main: "cli-export.cjs",
    },
    null,
    2,
  ),
  "utf8",
);

console.info(`[build-export-cli] wrote ${outfile}`);
