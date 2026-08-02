/**
 * Launch Electron with a clean env (strip ELECTRON_RUN_AS_NODE).
 * Usage: node scripts/launch-electron-clean.mjs <script> [args...]
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function resolveElectronBinary() {
  try {
    return require("electron");
  } catch {
    return "electron";
  }
}

const scriptArgs = process.argv.slice(2);
if (scriptArgs.length === 0) {
  console.error(
    "Usage: node scripts/launch-electron-clean.mjs <script> [args...]",
  );
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(resolveElectronBinary(), scriptArgs, {
  cwd: desktopRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
