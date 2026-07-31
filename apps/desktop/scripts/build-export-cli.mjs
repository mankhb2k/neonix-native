/**
 * Bundle render-worker cli-export for packaged Electron (no tsx).
 * Output: resources/export-cli/cli-export.cjs + native deps + ffmpeg binary.
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
const frameWorkerEntry = path.join(
  repoRoot,
  "apps",
  "render-worker",
  "src",
  "runtime",
  "frame-worker.ts",
);

const require = createRequire(
  path.join(repoRoot, "apps", "render-worker", "package.json"),
);

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyPackageTree(pkgName) {
  const pkgJson = require.resolve(`${pkgName}/package.json`, {
    paths: [path.join(repoRoot, "apps", "render-worker"), repoRoot],
  });
  const src = path.dirname(pkgJson);
  const dest = path.join(outDir, "node_modules", pkgName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  rimraf(dest);
  fs.cpSync(src, dest, { recursive: true });
  return dest;
}

/**
 * @napi-rs/canvas resolves platform packages as siblings under @napi-rs/.
 * pnpm places them next to canvas; plain copy of canvas alone misses .node.
 */
function canvasNativePackageName(platform = process.platform, arch = process.arch) {
  if (platform === "win32" && arch === "x64") {
    return "@napi-rs/canvas-win32-x64-msvc";
  }
  if (platform === "win32" && arch === "arm64") {
    return "@napi-rs/canvas-win32-arm64-msvc";
  }
  if (platform === "darwin" && arch === "arm64") {
    return "@napi-rs/canvas-darwin-arm64";
  }
  if (platform === "darwin" && arch === "x64") {
    return "@napi-rs/canvas-darwin-x64";
  }
  if (platform === "linux" && arch === "x64") {
    return "@napi-rs/canvas-linux-x64-gnu";
  }
  if (platform === "linux" && arch === "arm64") {
    return "@napi-rs/canvas-linux-arm64-gnu";
  }
  throw new Error(
    `Unsupported platform for @napi-rs/canvas native: ${platform}-${arch}`,
  );
}

function resolveCanvasNativeDir() {
  const canvasPkg = path.dirname(
    require.resolve("@napi-rs/canvas/package.json", {
      paths: [path.join(repoRoot, "apps", "render-worker"), repoRoot],
    }),
  );
  const nativeName = canvasNativePackageName();
  const sibling = path.join(path.dirname(canvasPkg), path.basename(nativeName));
  if (fs.existsSync(path.join(sibling, "package.json"))) {
    return sibling;
  }
  // Fallback: resolve via node (may fail under pnpm isolation).
  try {
    return path.dirname(
      require.resolve(`${nativeName}/package.json`, {
        paths: [canvasPkg, path.join(repoRoot, "apps", "render-worker"), repoRoot],
      }),
    );
  } catch {
    throw new Error(
      `Missing native canvas package ${nativeName} next to ${canvasPkg}. ` +
        `Install optionalDependencies for the build platform.`,
    );
  }
}

function copyCanvasNative() {
  const nativeName = canvasNativePackageName();
  const src = resolveCanvasNativeDir();
  const dest = path.join(outDir, "node_modules", nativeName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  rimraf(dest);
  fs.cpSync(src, dest, { recursive: true });

  const nodeFiles = fs
    .readdirSync(dest)
    .filter((name) => name.endsWith(".node"));
  if (nodeFiles.length === 0) {
    throw new Error(
      `Native canvas package ${nativeName} has no .node binary at ${dest}`,
    );
  }
  return dest;
}

function ensureFfmpegInstalled() {
  let ffmpegPath;
  try {
    ffmpegPath = require("ffmpeg-static");
  } catch (error) {
    throw new Error(
      `ffmpeg-static not resolvable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof ffmpegPath === "string" && fs.existsSync(ffmpegPath)) {
    return ffmpegPath;
  }

  const pkgJson = require.resolve("ffmpeg-static/package.json", {
    paths: [path.join(repoRoot, "apps", "render-worker"), repoRoot],
  });
  const pkgDir = path.dirname(pkgJson);
  const installJs = path.join(pkgDir, "install.js");
  console.info(
    `[build-export-cli] ffmpeg binary missing; running ${installJs}`,
  );
  const { spawnSync } = require("node:child_process");
  const result = spawnSync(process.execPath, [installJs], {
    cwd: pkgDir,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg-static install.js failed with status ${result.status ?? "?"}`,
    );
  }
  ffmpegPath = require("ffmpeg-static");
  if (typeof ffmpegPath !== "string" || !fs.existsSync(ffmpegPath)) {
    throw new Error(
      `ffmpeg-static still missing after install (got ${String(ffmpegPath)}).`,
    );
  }
  return ffmpegPath;
}

function copyFfmpegBinary() {
  const ffmpegPath = ensureFfmpegInstalled();
  const ext = process.platform === "win32" ? ".exe" : "";
  const destName = `ffmpeg${ext}`;
  const dest = path.join(outDir, destName);
  fs.copyFileSync(ffmpegPath, dest);
  try {
    fs.chmodSync(dest, 0o755);
  } catch {
    /* windows may ignore */
  }
  return dest;
}

function assertExportCliReady() {
  if (!fs.existsSync(outfile)) {
    throw new Error(`Missing bundled CLI: ${outfile}`);
  }
  const nativeDir = path.join(
    outDir,
    "node_modules",
    canvasNativePackageName(),
  );
  if (!fs.existsSync(nativeDir)) {
    throw new Error(`Missing native canvas dir: ${nativeDir}`);
  }
  const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const ffmpegDest = path.join(outDir, ffmpegName);
  if (!fs.existsSync(ffmpegDest)) {
    throw new Error(`Missing ffmpeg binary: ${ffmpegDest}`);
  }
}

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
copyCanvasNative();
const ffmpegDest = copyFfmpegBinary();

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

assertExportCliReady();

console.info(`[build-export-cli] wrote ${outfile}`);
console.info(`[build-export-cli] ffmpeg ${ffmpegDest}`);
console.info(
  `[build-export-cli] native ${canvasNativePackageName()} ok`,
);
