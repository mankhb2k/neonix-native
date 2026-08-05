import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MotionProject } from "@motionvideo/motion-schema";

export type ProbeFrame = { time: number; path: string };

export type ProbeContactSheetResult = {
  ok: boolean;
  outDir?: string;
  frames: ProbeFrame[];
  sceneId?: string;
  error?: string;
};

function repoRootFromHere(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // packages/ai-planner/src → repo root
  return path.resolve(here, "../../..");
}

/**
 * Thin wrapper around render-worker PNG contact-sheet CLI (P0.4).
 */
export async function probeContactSheetPng(
  project: MotionProject,
  options?: { outDir?: string; repoRoot?: string },
): Promise<ProbeContactSheetResult> {
  const root = options?.repoRoot ?? repoRootFromHere();
  const workerDir = path.join(root, "apps/render-worker");
  const tsxBin = path.join(root, "node_modules/.bin/tsx");
  const script = path.join(workerDir, "src/cli-contact-sheet.ts");
  const stamp = `${project.metadata.id}_${Date.now()}`;
  const workDir = options?.outDir ?? path.join(root, "tmp", "ai-contact-sheets", stamp);
  await mkdir(workDir, { recursive: true });
  const mtPath = path.join(workDir, "project.mt.json");
  await writeFile(mtPath, JSON.stringify(project, null, 2), "utf8");

  return new Promise((resolve) => {
    const child = spawn(tsxBin, [script, mtPath, workDir], {
      cwd: workerDir,
      env: process.env,
      shell: process.platform === "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      resolve({ ok: false, frames: [], error: err.message });
    });
    child.on("close", () => {
      const lines = stdout.trim().split("\n").filter(Boolean);
      const last = lines[lines.length - 1] ?? "{}";
      try {
        const parsed = JSON.parse(last) as ProbeContactSheetResult;
        if (parsed.ok) {
          resolve({
            ok: true,
            outDir: parsed.outDir ?? workDir,
            frames: parsed.frames ?? [],
            sceneId: parsed.sceneId,
          });
          return;
        }
        resolve({
          ok: false,
          frames: [],
          error: parsed.error || stderr.slice(-400) || "probe failed",
        });
      } catch {
        resolve({
          ok: false,
          frames: [],
          error: stderr.slice(-400) || stdout.slice(-400) || "probe parse failed",
        });
      }
    });
  });
}
