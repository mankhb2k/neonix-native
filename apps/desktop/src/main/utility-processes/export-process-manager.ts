/**
 * Spawns render-worker cli-export as a child process (Phase 9 MVP).
 */

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export type ExportCliResult =
  | { ok: true; mp4Path: string; projectId?: string }
  | { ok: false; error: string };

export type StartExportChildInput = {
  jobId: string;
  projectJsonPath: string;
  outDir: string;
  assetBaseDir: string;
  outputPath: string;
  /** Absolute path to repo root (for locating tsx + cli). */
  repoRoot: string;
  env?: NodeJS.ProcessEnv;
  onStderrLine?: (line: string) => void;
};

export type SpawnFn = typeof spawn;

export type ExportProcessManagerOptions = {
  spawnFn?: SpawnFn;
};

type ActiveJob = {
  child: ChildProcess;
  cancelled: boolean;
};

function parseLastJsonLine(stdout: string): ExportCliResult {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const row = JSON.parse(lines[i]!) as {
        ok?: boolean;
        mp4Path?: string;
        projectId?: string;
        error?: string;
      };
      if (row.ok === true && typeof row.mp4Path === "string") {
        return { ok: true, mp4Path: row.mp4Path, projectId: row.projectId };
      }
      if (row.ok === false) {
        return { ok: false, error: row.error ?? "Export failed." };
      }
    } catch {
      /* keep scanning */
    }
  }
  return { ok: false, error: "Export CLI produced no JSON result." };
}

export function createExportProcessManager(
  options: ExportProcessManagerOptions = {},
) {
  const spawnFn = options.spawnFn ?? spawn;
  const jobs = new Map<string, ActiveJob>();

  function resolveTsx(repoRoot: string): string {
    const bin = process.platform === "win32" ? "tsx.cmd" : "tsx";
    return path.join(repoRoot, "node_modules", ".bin", bin);
  }

  function resolveCli(repoRoot: string): string {
    return path.join(repoRoot, "apps", "render-worker", "src", "cli-export.ts");
  }

  function startJob(input: StartExportChildInput): Promise<ExportCliResult> {
    if (jobs.has(input.jobId)) {
      return Promise.resolve({
        ok: false,
        error: `Job already running: ${input.jobId}`,
      });
    }

    const tsxBin = resolveTsx(input.repoRoot);
    const script = resolveCli(input.repoRoot);
    const workerDir = path.join(input.repoRoot, "apps", "render-worker");

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const child = spawnFn(tsxBin, [script, input.projectJsonPath], {
        cwd: workerDir,
        env: {
          ...process.env,
          ...input.env,
          MOTIONVIDEO_EXPORT_OUT_DIR: input.outDir,
          MOTIONVIDEO_EXPORT_ASSET_BASE: input.assetBaseDir,
          MOTIONVIDEO_EXPORT_MP4_PATH: input.outputPath,
        },
        shell: process.platform === "win32",
      });

      const active: ActiveJob = { child, cancelled: false };
      jobs.set(input.jobId, active);

      const finish = (result: ExportCliResult) => {
        if (settled) return;
        settled = true;
        jobs.delete(input.jobId);
        resolve(result);
      };

      child.stdout?.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        const text = chunk.toString();
        stderr += text;
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) input.onStderrLine?.(line.trim());
        }
      });

      child.on("error", (err) => {
        finish({
          ok: false,
          error: err.message || "Failed to spawn export CLI.",
        });
      });

      child.on("close", (code) => {
        const job = jobs.get(input.jobId);
        if (job?.cancelled || active.cancelled) {
          finish({ ok: false, error: "cancelled" });
          return;
        }
        const parsed = parseLastJsonLine(stdout);
        if (parsed.ok) {
          finish(parsed);
          return;
        }
        const detail =
          parsed.error !== "Export CLI produced no JSON result."
            ? parsed.error
            : stderr.trim() || `Export CLI exited with code ${code ?? "?"}`;
        finish({ ok: false, error: detail });
      });
    });
  }

  function cancel(jobId: string): boolean {
    const job = jobs.get(jobId);
    if (!job) return false;
    job.cancelled = true;
    try {
      if (process.platform === "win32" && job.child.pid) {
        spawn("taskkill", ["/pid", String(job.child.pid), "/T", "/F"], {
          shell: true,
          stdio: "ignore",
        });
      } else {
        job.child.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
    return true;
  }

  function disposeAll(): void {
    for (const id of [...jobs.keys()]) {
      cancel(id);
    }
    jobs.clear();
  }

  function isActive(jobId: string): boolean {
    return jobs.has(jobId);
  }

  return { startJob, cancel, disposeAll, isActive };
}

export type ExportProcessManager = ReturnType<typeof createExportProcessManager>;
