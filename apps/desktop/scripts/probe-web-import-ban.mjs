/**
 * Probe: relative imports into apps/web must fail lint.
 * Run: node scripts/probe-web-import-ban.mjs
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-web-ban-"));
const probeFile = path.join(
  desktopRoot,
  "renderer",
  "src",
  "app",
  `__web_import_probe_${Date.now()}.tsx`,
);

const relativeWebImport = path
  .relative(path.dirname(probeFile), path.join(desktopRoot, "..", "web", "package.json"))
  .replaceAll("\\", "/");

try {
  fs.writeFileSync(
    probeFile,
    `import webPkg from "${relativeWebImport}";\nexport const x = webPkg;\n`,
    "utf8",
  );

  let failed = false;
  try {
    execFileSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "eslint", probeFile, "--max-warnings", "0"],
      {
        cwd: desktopRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    failed = true;
  }

  if (!failed) {
    console.error(
      "[probe-web-import-ban] expected eslint to reject relative apps/web import",
    );
    process.exit(1);
  }

  console.log("[probe-web-import-ban] ok — relative web import banned");
} finally {
  try {
    fs.unlinkSync(probeFile);
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
