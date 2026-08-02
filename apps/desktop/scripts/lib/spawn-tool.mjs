/**
 * Spawn helpers without shell:true (avoids Node DEP0190).
 * On Windows, .cmd shims cannot be spawned with shell:false — use cmd.exe /c.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export function resolvePnpmBinary() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function quoteWindowsCmdArg(arg) {
  const s = String(arg);
  if (!/[\s"&<>|^]/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

export function resolveVitestCli(fromPackageJson) {
  const req = createRequire(fromPackageJson);
  const pkgDir = path.dirname(req.resolve("vitest/package.json"));
  return path.join(pkgDir, "vitest.mjs");
}

export function resolveElectronBuilderCli(fromPackageJson) {
  const req = createRequire(fromPackageJson);
  const pkgDir = path.dirname(req.resolve("electron-builder/package.json"));
  return path.join(pkgDir, "cli.js");
}

/** @returns {import("node:child_process").SpawnSyncReturns<string>} */
export function spawnSyncNoShell(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
    shell: false,
  });
}

/**
 * Run pnpm without shell:true.
 * Windows: `cmd.exe /d /s /c pnpm …` (pnpm.cmd cannot spawn with shell:false).
 */
export function runPnpm(args, options = {}) {
  if (process.platform === "win32") {
    const cmdline = ["pnpm", ...args].map(quoteWindowsCmdArg).join(" ");
    return spawnSyncNoShell(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", cmdline],
      options,
    );
  }
  return spawnSyncNoShell("pnpm", args, options);
}

export function runVitest(desktopRoot, args, options = {}) {
  const packageJson = path.join(desktopRoot, "package.json");
  const cli = resolveVitestCli(packageJson);
  return spawnSyncNoShell(process.execPath, [cli, ...args], {
    cwd: desktopRoot,
    ...options,
  });
}

export function runElectronBuilder(desktopRoot, args, options = {}) {
  const packageJson = path.join(desktopRoot, "package.json");
  const cli = resolveElectronBuilderCli(packageJson);
  return spawnSyncNoShell(process.execPath, [cli, ...args], {
    cwd: desktopRoot,
    ...options,
  });
}

export function scriptsDirFromMeta(importMetaUrl) {
  return path.dirname(fileURLToPath(importMetaUrl));
}
