/**
 * In-process export job registry for web (P6) — persists across requests in one Node process.
 * Swap for Redis/BullMQ when multi-instance is required.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RenderJobProgress, RenderJobStatus } from "@motionvideo/shared";
import type { MotionProject } from "@motionvideo/motion-schema";

export type ExportJobRecord = RenderJobProgress & {
  projectId: string;
  child?: ChildProcess;
  artifactBytes?: Buffer;
};

const jobs = new Map<string, ExportJobRecord>();

function repoRoot(): string {
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/apps/web")) {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

function mapStage(stage: string): RenderJobStatus {
  if (stage === "planning") return "planning";
  if (stage === "rendering") return "rendering";
  if (stage === "encoding") return "encoding";
  if (stage === "done") return "done";
  return "rendering";
}

export function getExportJob(jobId: string): ExportJobRecord | undefined {
  return jobs.get(jobId);
}

export function listExportJobs(): ExportJobRecord[] {
  return [...jobs.values()].map(({ child: _c, artifactBytes: _b, ...rest }) => rest as ExportJobRecord);
}

export function cancelExportJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
    return false;
  }
  try {
    job.child?.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  job.status = "cancelled";
  job.progress = 0;
  job.updatedAt = Date.now();
  job.child = undefined;
  return true;
}

export async function startExportJob(project: MotionProject): Promise<ExportJobRecord> {
  const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const record: ExportJobRecord = {
    jobId,
    projectId: project.metadata.id,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(jobId, record);

  const root = repoRoot();
  const tmpDir = path.join(root, "tmp", "export-jobs", jobId);
  await mkdir(tmpDir, { recursive: true });
  const mtPath = path.join(tmpDir, `${project.metadata.id}.mt`);
  await writeFile(mtPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  const mp4Path = path.join(tmpDir, "out.mp4");

  const workerDir = path.join(root, "apps/render-worker");
  const tsxBin = path.join(root, "node_modules/.bin/tsx");
  const script = path.join(workerDir, "src/cli-export.ts");

  record.status = "planning";
  record.progress = 0.05;
  record.updatedAt = Date.now();

  const child = spawn(tsxBin, [script, mtPath], {
    cwd: workerDir,
    env: {
      ...process.env,
      MOTIONVIDEO_EXPORT_OUT_DIR: tmpDir,
      MOTIONVIDEO_EXPORT_MP4_PATH: mp4Path,
      MOTIONVIDEO_EXPORT_SCALE: process.env.MOTIONVIDEO_EXPORT_SCALE ?? "0.5",
    },
    shell: process.platform === "win32",
  });
  record.child = child;

  let stdout = "";
  child.stdout.on("data", (d: Buffer) => {
    stdout += d.toString();
  });
  child.stderr.on("data", (d: Buffer) => {
    const text = d.toString();
    for (const line of text.split("\n")) {
      if (!line.startsWith("progress\t")) continue;
      const [, stage, ratioRaw] = line.trim().split("\t");
      const ratio = Number(ratioRaw);
      if (!stage || !Number.isFinite(ratio)) continue;
      const current = jobs.get(jobId);
      if (!current || current.status === "cancelled") continue;
      current.stage = stage;
      current.status = mapStage(stage);
      current.progress = Math.min(1, Math.max(0, ratio));
      current.updatedAt = Date.now();
    }
  });

  child.on("close", async (code) => {
    const current = jobs.get(jobId);
    if (!current || current.status === "cancelled") return;
    current.child = undefined;
    const lines = stdout.trim().split("\n").filter(Boolean);
    const last = lines[lines.length - 1];
    try {
      const parsed = JSON.parse(last ?? "{}") as {
        ok?: boolean;
        mp4Path?: string;
        error?: string;
      };
      if (parsed.ok && (parsed.mp4Path || mp4Path)) {
        const artifact = parsed.mp4Path ?? mp4Path;
        current.artifactPath = artifact;
        current.artifactBytes = await readFile(artifact);
        current.status = "done";
        current.progress = 1;
        current.updatedAt = Date.now();
        return;
      }
      current.status = "failed";
      current.error = parsed.error || `cli-export exited ${code}`;
      current.updatedAt = Date.now();
    } catch {
      current.status = "failed";
      current.error = `cli-export exited ${code}`;
      current.updatedAt = Date.now();
    }
  });

  child.on("error", (err) => {
    const current = jobs.get(jobId);
    if (!current || current.status === "cancelled") return;
    current.status = "failed";
    current.error = err.message;
    current.updatedAt = Date.now();
    current.child = undefined;
  });

  return record;
}

export function toPublicJob(job: ExportJobRecord): RenderJobProgress & {
  hasArtifact: boolean;
} {
  return {
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error,
    artifactPath: job.artifactPath,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    hasArtifact: Boolean(job.artifactBytes?.length),
  };
}
