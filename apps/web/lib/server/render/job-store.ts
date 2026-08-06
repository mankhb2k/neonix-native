/**
 * Persistent render job store — file-backed (survives process restart).
 * Not an in-memory Map.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RenderJobStatus } from "@motionvideo/render-contracts";

export type PersistentRenderJob = {
  jobId: string;
  userId: string;
  projectId: string;
  projectRevision: number;
  idempotencyKey: string;
  status: RenderJobStatus;
  progress: number;
  stage?: string;
  error?: string;
  /** Serialized export canary (engine/capability/preflight). */
  canaryJson?: string;
  lambdaRenderId?: string;
  bucketName?: string;
  outputKey?: string;
  artifactPath?: string;
  createdAt: number;
  updatedAt: number;
};

function repoRoot(): string {
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/apps/web")) {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

export function renderJobsRootDir(): string {
  return (
    process.env.MOTIONVIDEO_RENDER_JOBS_DIR ??
    path.join(repoRoot(), "tmp", "render-jobs")
  );
}

function jobPath(jobId: string): string {
  return path.join(renderJobsRootDir(), `${jobId}.json`);
}

function idempotencyIndexPath(): string {
  return path.join(renderJobsRootDir(), "_idempotency.json");
}

async function readIdempotencyIndex(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(idempotencyIndexPath(), "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeIdempotencyIndex(
  index: Record<string, string>,
): Promise<void> {
  await mkdir(renderJobsRootDir(), { recursive: true });
  await writeFile(idempotencyIndexPath(), `${JSON.stringify(index, null, 2)}\n`);
}

export async function saveRenderJob(job: PersistentRenderJob): Promise<void> {
  await mkdir(renderJobsRootDir(), { recursive: true });
  await writeFile(jobPath(job.jobId), `${JSON.stringify(job, null, 2)}\n`);
}

export async function getRenderJob(
  jobId: string,
): Promise<PersistentRenderJob | null> {
  try {
    const raw = await readFile(jobPath(jobId), "utf8");
    return JSON.parse(raw) as PersistentRenderJob;
  } catch {
    return null;
  }
}

export async function listRenderJobs(): Promise<PersistentRenderJob[]> {
  await mkdir(renderJobsRootDir(), { recursive: true });
  const files = await readdir(renderJobsRootDir());
  const jobs: PersistentRenderJob[] = [];
  for (const file of files) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    const job = await getRenderJob(file.replace(/\.json$/, ""));
    if (job) jobs.push(job);
  }
  return jobs;
}

export async function findJobByIdempotencyKey(
  key: string,
): Promise<PersistentRenderJob | null> {
  const index = await readIdempotencyIndex();
  const jobId = index[key];
  if (!jobId) return null;
  return getRenderJob(jobId);
}

export async function createRenderJob(input: {
  userId: string;
  projectId: string;
  projectRevision: number;
  idempotencyKey: string;
}): Promise<{ job: PersistentRenderJob; created: boolean }> {
  const existing = await findJobByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { job: existing, created: false };
  }

  const now = Date.now();
  const job: PersistentRenderJob = {
    jobId: `rnd_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    projectId: input.projectId,
    projectRevision: input.projectRevision,
    idempotencyKey: input.idempotencyKey,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };

  const index = await readIdempotencyIndex();
  if (index[input.idempotencyKey]) {
    // Race: another writer won
    const raced = await getRenderJob(index[input.idempotencyKey]!);
    if (raced) return { job: raced, created: false };
  }
  index[input.idempotencyKey] = job.jobId;
  await writeIdempotencyIndex(index);
  await saveRenderJob(job);
  return { job, created: true };
}

export async function updateRenderJob(
  jobId: string,
  patch: Partial<PersistentRenderJob>,
): Promise<PersistentRenderJob | null> {
  const current = await getRenderJob(jobId);
  if (!current) return null;
  const next: PersistentRenderJob = {
    ...current,
    ...patch,
    jobId: current.jobId,
    updatedAt: Date.now(),
  };
  await saveRenderJob(next);
  return next;
}

export function assertJobOwner(
  job: PersistentRenderJob,
  userId: string,
): void {
  if (job.userId !== userId) {
    throw new Error("FORBIDDEN_JOB_OWNERSHIP");
  }
}
