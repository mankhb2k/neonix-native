/**
 * Spawns render-worker cli-export as a child process.
 * Packaged: Electron as Node (`ELECTRON_RUN_AS_NODE`) + bundled CLI.
 * Dev: tsx + TypeScript source in the repo.
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
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
  /** Absolute path to repo root (dev) or resources root (packaged). */
  repoRoot: string;
  /** When set, prefer this CLI entry (packaged bundle). */
  cliEntry?: string;
  env?: NodeJS.ProcessEnv;
  onStderrLine?: (line: string) => void;
};

export type SpawnFn = typeof spawn;

export type ExportProcessManagerOptions = {
  spawnFn?: SpawnFn;
  /** true → ELECTRON_RUN_AS_NODE + bundled CLI when available */
  packaged?: boolean;
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

function resolveTsx(repoRoot: string): string {
  const bin = process.platform === "win32" ? "tsx.cmd" : "tsx";
  return path.join(repoRoot, "node_modules", ".bin", bin);
}

function resolveDevCli(repoRoot: string): string {
  return path.join(repoRoot, "apps", "render-worker", "src", "cli-export.ts");
}

function resolvePackagedCli(resourcesRoot: string): string | null {
  const candidate = path.join(resourcesRoot, "export-cli", "cli-export.cjs");
  return fs.existsSync(candidate) ? candidate : null;
}

export function createExportProcessManager(
  options: ExportProcessManagerOptions = {},
) {
  const spawnFn = options.spawnFn ?? spawn;
  const jobs = new Map<string, ActiveJob>();

  function startJob(input: StartExportChildInput): Promise<ExportCliResult> {
    if (jobs.has(input.jobId)) {
      return Promise.resolve({
        ok: false,
        error: `Job already running: ${input.jobId}`,
      });
    }

    const packagedCli =
      input.cliEntry ??
      (options.packaged ? resolvePackagedCli(input.repoRoot) : null);

    let command: string;
    let args: string[];
    let cwd: string;
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...input.env,
      MOTIONVIDEO_EXPORT_OUT_DIR: input.outDir,
      MOTIONVIDEO_EXPORT_ASSET_BASE: input.assetBaseDir,
      MOTIONVIDEO_EXPORT_MP4_PATH: input.outputPath,
    };

    if (packagedCli) {
      command = process.execPath;
      args = [packagedCli, input.projectJsonPath];
      cwd = path.dirname(packagedCli);
      childEnv.ELECTRON_RUN_AS_NODE = "1";
      if (!childEnv.MOTIONVIDEO_REPO_ROOT) {
        childEnv.MOTIONVIDEO_REPO_ROOT = input.repoRoot;
      }
    } else if (options.packaged) {
      return Promise.resolve({
        ok: false,
        error:
          "Packaged export CLI missing (resources/export-cli/cli-export.cjs). Rebuild with build:export-cli.",
      });
    } else {
      command = resolveTsx(input.repoRoot);
      args = [resolveDevCli(input.repoRoot), input.projectJsonPath];
      cwd = path.join(input.repoRoot, "apps", "render-worker");
    }

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const child = spawnFn(command, args, {
        cwd,
        env: childEnv,
        shell: process.platform === "win32" && !packagedCli,
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
        if (active.cancelled) {
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
