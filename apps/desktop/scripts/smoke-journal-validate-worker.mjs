/**
 * Dist artifact smoke (not full packaged Electron).
 * Packaged Electron smoke: `pnpm test:journal-worker:packaged`
 *
 *   pnpm --filter @motionvideo/desktop test:journal-worker
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runVitest } from "./lib/spawn-tool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const workerDist = path.join(
  desktopRoot,
  "dist",
  "main",
  "journal-validate-worker.js",
);
const outReport = path.join(
  desktopRoot,
  "tmp",
  "journal-validate-worker-smoke.json",
);

function fail(reason, extra = {}) {
  fs.mkdirSync(path.dirname(outReport), { recursive: true });
  fs.writeFileSync(
    outReport,
    `${JSON.stringify({ ok: false, reason, ...extra }, null, 2)}\n`,
  );
  console.error("[smoke-journal-validate-worker] FAIL:", reason, extra);
  process.exit(1);
}

function ok(payload) {
  fs.mkdirSync(path.dirname(outReport), { recursive: true });
  fs.writeFileSync(
    outReport,
    `${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`,
  );
  console.info("[smoke-journal-validate-worker] OK", JSON.stringify(payload));
}

if (!fs.existsSync(workerDist)) {
  fail("missing-worker-bundle", { workerDist });
}

const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mv-asar-sim-"));
const asarBeside = path.join(
  fakeRoot,
  "app.asar",
  "dist",
  "main",
  "journal-validate-worker.js",
);
const unpackedBeside = asarBeside.replace(
  `${path.sep}app.asar${path.sep}`,
  `${path.sep}app.asar.unpacked${path.sep}`,
);
fs.mkdirSync(path.dirname(unpackedBeside), { recursive: true });
fs.copyFileSync(workerDist, unpackedBeside);
if (!fs.existsSync(unpackedBeside)) {
  fail("asar-unpacked-layout", { unpackedBeside });
}

const vitest = runVitest(
  desktopRoot,
  [
    "run",
    "--project",
    "node",
    "src/__tests__/journal-validate-worker-artifact.test.ts",
  ],
  { cwd: desktopRoot },
);
if (vitest.status !== 0) {
  fail("artifact-vitest", {
    status: vitest.status,
    tail: `${vitest.stdout}\n${vitest.stderr}`.slice(-2500),
  });
}

ok({
  workerDist,
  asarUnpackedSim: unpackedBeside,
  note: "dist artifact only — use test:journal-worker:packaged for electron-builder dir smoke",
});

try {
  fs.rmSync(fakeRoot, { recursive: true, force: true });
} catch {
  /* ignore */
}
