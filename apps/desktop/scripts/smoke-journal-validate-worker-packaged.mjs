/**
 * Real packaged Electron smoke (electron-builder --win dir, not NSIS).
 * Launches the unpacked executable with smoke env + harness nonce,
 * asserts validate+hash for a >1MB document reports via===worker,
 * and requires a clean process exit (status 0, no signal, no spawn error).
 *
 *   pnpm --filter @motionvideo/desktop test:journal-worker:packaged
 *
 * Reuse an existing win-unpacked tree:
 *   MOTIONVIDEO_SKIP_PACK=1 pnpm test:journal-worker:packaged
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runElectronBuilder,
  runPnpm,
} from "./lib/spawn-tool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const outReport = path.join(
  desktopRoot,
  "tmp",
  "journal-validate-worker-packaged-smoke.json",
);
const winUnpacked = path.join(desktopRoot, "release", "win-unpacked");
const productExe = path.join(winUnpacked, "MotionVideo.exe");
const unpackedWorker = path.join(
  winUnpacked,
  "resources",
  "app.asar.unpacked",
  "dist",
  "main",
  "journal-validate-worker.js",
);

function fail(reason, extra = {}) {
  fs.mkdirSync(path.dirname(outReport), { recursive: true });
  fs.writeFileSync(
    outReport,
    `${JSON.stringify({ ok: false, reason, ...extra }, null, 2)}\n`,
  );
  console.error("[smoke-journal-validate-worker-packaged] FAIL:", reason, extra);
  process.exit(1);
}

function ok(payload) {
  fs.mkdirSync(path.dirname(outReport), { recursive: true });
  fs.writeFileSync(
    outReport,
    `${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`,
  );
  console.info(
    "[smoke-journal-validate-worker-packaged] OK",
    JSON.stringify(payload),
  );
}

function ensurePackagedDir() {
  const skip = process.env.MOTIONVIDEO_SKIP_PACK === "1";
  if (skip && fs.existsSync(productExe) && fs.existsSync(unpackedWorker)) {
    console.info(
      "[smoke-journal-validate-worker-packaged] reusing win-unpacked (MOTIONVIDEO_SKIP_PACK=1)",
    );
    return;
  }

  console.info("[smoke-journal-validate-worker-packaged] build:release…");
  const build = runPnpm(["build:release"], {
    cwd: desktopRoot,
    stdio: "inherit",
  });
  if (build.status !== 0) fail("build-release-failed", { status: build.status });

  console.info(
    "[smoke-journal-validate-worker-packaged] electron-builder --win dir…",
  );
  const pack = runElectronBuilder(desktopRoot, ["--win", "dir"], {
    cwd: desktopRoot,
    stdio: "inherit",
  });
  if (pack.status !== 0) {
    fail("electron-builder-dir-failed", { status: pack.status });
  }
}

ensurePackagedDir();

if (!fs.existsSync(productExe)) {
  fail("missing-unpacked-exe", { productExe });
}
if (!fs.existsSync(unpackedWorker)) {
  fail("missing-asar-unpacked-worker", { unpackedWorker });
}

const smokeToken = crypto.randomBytes(16).toString("hex");
const probeOut = path.join(
  os.tmpdir(),
  `mv-journal-worker-smoke-${smokeToken}.json`,
);
try {
  fs.unlinkSync(probeOut);
} catch {
  /* ignore */
}

const env = {
  ...process.env,
  MOTIONVIDEO_JOURNAL_WORKER_SMOKE: "1",
  MOTIONVIDEO_JOURNAL_WORKER_SMOKE_TOKEN: smokeToken,
  MOTIONVIDEO_JOURNAL_WORKER_SMOKE_OUT: probeOut,
};
delete env.ELECTRON_RUN_AS_NODE;

console.info(
  "[smoke-journal-validate-worker-packaged] launching",
  productExe,
);
const run = spawnSync(productExe, [], {
  cwd: winUnpacked,
  env,
  encoding: "utf8",
  shell: false,
  timeout: 120_000,
});

if (run.error) {
  fail("spawn-error", {
    error: run.error.message,
    status: run.status,
    signal: run.signal,
  });
}
if (run.signal) {
  fail("process-signal", {
    signal: run.signal,
    status: run.status,
    stdout: (run.stdout || "").slice(-2000),
    stderr: (run.stderr || "").slice(-2000),
  });
}
if (run.status !== 0) {
  fail("process-nonzero-exit", {
    status: run.status,
    stdout: (run.stdout || "").slice(-2000),
    stderr: (run.stderr || "").slice(-2000),
  });
}

if (!fs.existsSync(probeOut)) {
  fail("missing-probe-report", {
    status: run.status,
    signal: run.signal,
    stdout: (run.stdout || "").slice(-2000),
    stderr: (run.stderr || "").slice(-2000),
  });
}

let probe;
try {
  probe = JSON.parse(fs.readFileSync(probeOut, "utf8"));
} catch (error) {
  fail("probe-report-parse", {
    error: error instanceof Error ? error.message : String(error),
  });
}

if (!probe.packaged) {
  fail("probe-not-packaged", { probe });
}
if (probe.via !== "worker") {
  fail("probe-via-not-worker", { probe });
}
if (!probe.ok) {
  fail("probe-failed", { probe });
}

ok({
  productExe,
  unpackedWorker,
  probeOut,
  probe,
  exitStatus: run.status,
  signal: run.signal,
  note: "electron-builder --win dir unpacked smoke (not NSIS)",
});

try {
  fs.unlinkSync(probeOut);
} catch {
  /* ignore */
}
