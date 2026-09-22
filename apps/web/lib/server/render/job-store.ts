/**
 * Persistent render job store.
 * Database-backed jobs are the production source of truth; file-backed jobs
 * remain available for local development and renderer tests.
 */

import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  assertContiguousRenderChunkManifest,
  buildRenderChunkManifest,
  type RenderChunkManifest,
  type RenderChunkManifestOptions,
} from "@motionvideo/export-renderer";
import type { RenderJobStatus } from "@motionvideo/export-renderer/contracts";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

export type PersistentRenderJob = {
  jobId: string;
  userId: string;
  /**
   * Only set for database-backed jobs (undefined for local file-backed jobs
   * used in dev/tests, which have no real workspace to check). Access control
   * and the R2 output key are scoped to this, not to `userId` alone, so a
   * shared team workspace's members can see and download each other's
   * renders rather than only the person who happened to click render.
   */
  workspaceId?: string;
  projectId: string;
  projectRevision: number;
  idempotencyKey: string;
  status: RenderJobStatus;
  progress: number;
  stage?: string;
  error?: string;
  /** Serialized export canary (engine/capability/preflight). */
  canaryJson?: string;
  outputKey?: string;
  artifactPath?: string;
  metrics?: {
    framesRendered?: number;
    outputSizeInBytes?: number;
    timeToRenderFrames?: number;
    timeToEncode?: number;
    timeToFinish?: number;
    audioStreams?: number;
    verifiedFrames?: number;
    verifiedDurationSeconds?: number;
    verifiedCodec?: string;
    audioPreparationMilliseconds?: number;
    encodeBreakdown?: {
      framesSubmitted: number;
      pipeWriteMilliseconds: number;
      backpressureWaitMilliseconds: number;
      finalizeMilliseconds: number;
    };
  };
  heartbeatAt?: number;
  leaseOwner?: string;
  attemptCount?: number;
  cancelRequested?: boolean;
  chunkManifest?: RenderChunkManifest;
  chunkManifestChecksum?: string;
  chunkSize?: number;
  chunkCount?: number;
  chunkParallelism?: number;
  runtimeManifestSha256?: string;
  createdAt: number;
  updatedAt: number;
};

type SupabaseRenderJobRow = {
  id: string;
  public_ref: string;
  workspace_id: string;
  project_id: string;
  revision_id: string;
  status: string;
  preset_json: Record<string, unknown>;
  idempotency_key: string;
  provider_render_id: string | null;
  output_key: string | null;
  artifact_path: string | null;
  error_code: string | null;
  progress: number;
  stage: string | null;
  metrics_json: Record<string, unknown>;
  runtime_json: RuntimeProjectV3 | null;
  runtime_manifest_text?: string | null;
  runtime_manifest_chunk_count?: number | null;
  runtime_manifest_sha256?: string | null;
  heartbeat_at: string | null;
  lease_owner: string | null;
  attempt_count: number;
  cancel_requested: boolean;
  chunk_manifest_json: RenderChunkManifest | null;
  chunk_manifest_checksum: string | null;
  chunk_size: number | null;
  chunk_count: number | null;
  chunk_parallelism: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

type RecoveredRenderJob = { jobId: string; status: string };

function isRecoveredRenderJob(value: unknown): value is RecoveredRenderJob {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.jobId === "string" && typeof record.status === "string";
}

const SUPABASE_RENDER_JOB_COLUMNS = "id, public_ref, workspace_id, project_id, revision_id, status, preset_json, idempotency_key, provider_render_id, output_key, artifact_path, error_code, progress, stage, metrics_json, runtime_json, runtime_manifest_chunk_count, runtime_manifest_sha256, heartbeat_at, lease_owner, attempt_count, cancel_requested, chunk_manifest_json, chunk_manifest_checksum, chunk_size, chunk_count, chunk_parallelism, created_by, created_at, updated_at, finished_at";

const DEFAULT_INLINE_RUNTIME_MAX_BYTES = 4 * 1024 * 1024;
const RUNTIME_UPLOAD_CHUNK_BYTES = 1024 * 1024;

function createRenderDatabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function runtimeManifestBytes(runtime: RuntimeProjectV3): Buffer {
  return Buffer.from(JSON.stringify(runtime), "utf8");
}

/**
 * Uploads a large runtime through private service-role RPCs, then commits the
 * assembled JSON into private manifest chunks in one database transaction.
 * The queue and workers still read only render_jobs; upload rows are staging
 * state and are not a second source of truth.
 */
export async function persistLargeRuntimeManifest(
  jobId: string,
  runtime: RuntimeProjectV3,
): Promise<{ bytes: number; chunkCount: number; sha256: string }> {
  const client = createRenderDatabaseClient();
  if (!client) throw new Error("Supabase is required to persist a large runtime manifest");
  const parent = await client.from("render_jobs").select("id, runtime_json, runtime_manifest_chunk_count, runtime_manifest_sha256").eq("public_ref", jobId).single();
  if (parent.error || !parent.data) throw new Error(`Unable to resolve render job for runtime upload: ${parent.error?.message ?? "missing row"}`);
  if (parent.data.runtime_json || parent.data.runtime_manifest_chunk_count) {
    return {
      bytes: 0,
      chunkCount: Number(parent.data.runtime_manifest_chunk_count ?? 0),
      sha256: typeof parent.data.runtime_manifest_sha256 === "string" ? parent.data.runtime_manifest_sha256 : "already-committed",
    };
  }

  const payload = runtimeManifestBytes(runtime);
  const sha256 = createHash("sha256").update(payload).digest("hex");
  const chunkCount = Math.ceil(payload.byteLength / RUNTIME_UPLOAD_CHUNK_BYTES);
  const begin = await client.rpc("render_job_runtime_upload_begin", {
    p_job_id: parent.data.id,
    p_total_bytes: payload.byteLength,
    p_chunk_size: RUNTIME_UPLOAD_CHUNK_BYTES,
    p_chunk_count: chunkCount,
    p_sha256: sha256,
  });
  if (begin.error) throw new Error(`Unable to begin runtime upload: ${begin.error.message}`);

  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * RUNTIME_UPLOAD_CHUNK_BYTES;
    const chunk = payload.subarray(start, Math.min(payload.byteLength, start + RUNTIME_UPLOAD_CHUNK_BYTES));
    const result = await client.rpc("render_job_runtime_upload_put", {
      p_job_id: parent.data.id,
      p_chunk_index: index,
      p_chunk_base64: chunk.toString("base64"),
    });
    if (result.error) throw new Error(`Unable to upload runtime chunk ${index}: ${result.error.message}`);
  }

  const committed = await client.rpc("render_job_runtime_upload_commit", { p_job_id: parent.data.id });
  if (committed.error) throw new Error(`Unable to commit runtime upload: ${committed.error.message}`);
  return { bytes: payload.byteLength, chunkCount, sha256 };
}

/** Deletes only expired runtime-upload staging rows; committed manifest chunks remain immutable. */
export async function cleanupRenderManifestUploads(olderThanSeconds = 604800, limit = 500): Promise<{ chunkRowsDeleted: number; uploadRowsDeleted: number }> {
  const client = createRenderDatabaseClient();
  if (!client) return { chunkRowsDeleted: 0, uploadRowsDeleted: 0 };
  const result = await client.rpc("render_job_runtime_upload_cleanup", {
    p_older_than_seconds: Math.max(0, Math.floor(olderThanSeconds)),
    p_limit: Math.max(1, Math.floor(limit)),
  });
  if (result.error || !result.data || typeof result.data !== "object") {
    throw new Error(`Unable to cleanup runtime manifest uploads: ${result.error?.message ?? "invalid response"}`);
  }
  const data = result.data as Record<string, unknown>;
  return {
    chunkRowsDeleted: Number(data.chunkRowsDeleted ?? 0),
    uploadRowsDeleted: Number(data.uploadRowsDeleted ?? 0),
  };
}

function isRenderJobStatus(value: string): value is RenderJobStatus {
  return ["queued", "planning", "rendering", "encoding", "muxing", "publishing", "done", "failed", "cancelled"].includes(value);
}

function asMetrics(value: Record<string, unknown> | null | undefined): PersistentRenderJob["metrics"] {
  if (!value) return undefined;
  const numberValue = (key: string) => typeof value[key] === "number" ? value[key] : undefined;
  const numberValueFromRecord = (record: object, key: string) => {
    const candidate = (record as Record<string, unknown>)[key];
    return typeof candidate === "number" ? candidate : undefined;
  };
  return {
    framesRendered: numberValue("framesRendered"),
    outputSizeInBytes: numberValue("outputSizeInBytes"),
    timeToRenderFrames: numberValue("timeToRenderFrames"),
    timeToEncode: numberValue("timeToEncode"),
    timeToFinish: numberValue("timeToFinish"),
    audioStreams: numberValue("audioStreams"),
    verifiedFrames: numberValue("verifiedFrames"),
    verifiedDurationSeconds: numberValue("verifiedDurationSeconds"),
    verifiedCodec: typeof value.verifiedCodec === "string" ? value.verifiedCodec : undefined,
    audioPreparationMilliseconds: numberValue("audioPreparationMilliseconds"),
    encodeBreakdown: value.encodeBreakdown && typeof value.encodeBreakdown === "object"
      ? {
        framesSubmitted: numberValueFromRecord(value.encodeBreakdown, "framesSubmitted") ?? 0,
        pipeWriteMilliseconds: numberValueFromRecord(value.encodeBreakdown, "pipeWriteMilliseconds") ?? 0,
        backpressureWaitMilliseconds: numberValueFromRecord(value.encodeBreakdown, "backpressureWaitMilliseconds") ?? 0,
        finalizeMilliseconds: numberValueFromRecord(value.encodeBreakdown, "finalizeMilliseconds") ?? 0,
      }
      : undefined,
  };
}

function fromSupabaseRow(row: SupabaseRenderJobRow): PersistentRenderJob {
  return {
    jobId: row.public_ref,
    userId: row.created_by,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    projectRevision: Number(row.preset_json.projectRevision ?? 0),
    idempotencyKey: row.idempotency_key,
    status: isRenderJobStatus(row.status) ? row.status : "failed",
    progress: Number(row.progress ?? 0),
    stage: row.stage ?? undefined,
    error: row.error_code ?? undefined,
    outputKey: row.output_key ?? undefined,
    artifactPath: row.artifact_path ?? undefined,
    metrics: asMetrics(row.metrics_json),
    heartbeatAt: row.heartbeat_at ? Date.parse(row.heartbeat_at) : undefined,
    leaseOwner: row.lease_owner ?? undefined,
    attemptCount: row.attempt_count ?? 0,
    cancelRequested: row.cancel_requested ?? false,
    chunkManifest: row.chunk_manifest_json ?? undefined,
    chunkManifestChecksum: row.chunk_manifest_checksum ?? undefined,
    chunkSize: row.chunk_size ?? undefined,
    chunkCount: row.chunk_count ?? undefined,
    chunkParallelism: row.chunk_parallelism ?? undefined,
    runtimeManifestSha256: row.runtime_manifest_sha256 ?? undefined,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at ?? row.created_at),
  };
}

function repoRoot(): string {
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/apps/web")) {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

/**
 * Falls back to `userId` only for local file-backed jobs (no real workspace
 * to scope by). Database-backed jobs always have a workspaceId and are keyed
 * by it, matching how every other workspace-owned resource (assets, projects)
 * is stored in R2/Postgres.
 */
export function buildRenderOutputKey(job: Pick<PersistentRenderJob, "userId" | "workspaceId">, jobId: string): string {
  return `${job.workspaceId ?? job.userId}/${jobId}.mp4`;
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

async function hasLocalRenderJob(jobId: string): Promise<boolean> {
  try {
    await readFile(jobPath(jobId), "utf8");
    return true;
  } catch {
    return false;
  }
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
  await writeAtomic(idempotencyIndexPath(), `${JSON.stringify(index, null, 2)}\n`);
}

async function writeAtomic(target: string, content: string): Promise<void> {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, target);
}

export async function saveRenderJob(job: PersistentRenderJob): Promise<void> {
  await mkdir(renderJobsRootDir(), { recursive: true });
  await writeAtomic(jobPath(job.jobId), `${JSON.stringify(job, null, 2)}\n`);
}

export async function getRenderJob(
  jobId: string,
): Promise<PersistentRenderJob | null> {
  try {
    const raw = await readFile(jobPath(jobId), "utf8");
    return JSON.parse(raw) as PersistentRenderJob;
  } catch {
    const client = createRenderDatabaseClient();
    if (!client) return null;
    const result = await client.from("render_jobs").select(SUPABASE_RENDER_JOB_COLUMNS).eq("public_ref", jobId).maybeSingle();
    if (result.error || !result.data) return null;
    return fromSupabaseRow(result.data);
  }
}

export async function listRenderJobs(): Promise<PersistentRenderJob[]> {
  const databaseClient = createRenderDatabaseClient();

  // Vercel's deployed function filesystem is read-only. Production jobs are
  // database-backed, so do not touch the local render-job directory there.
  if (databaseClient && process.env.NODE_ENV === "production") {
    const result = await databaseClient
      .from("render_jobs")
      .select(SUPABASE_RENDER_JOB_COLUMNS)
      .order("created_at", { ascending: false });
    if (result.error) throw new Error(`Unable to list render jobs: ${result.error.message}`);
    return (result.data ?? []).map(fromSupabaseRow);
  }

  await mkdir(renderJobsRootDir(), { recursive: true });
  const files = await readdir(renderJobsRootDir());
  const jobs: PersistentRenderJob[] = [];
  for (const file of files) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    const job = await getRenderJob(file.replace(/\.json$/, ""));
    if (job) jobs.push(job);
  }
  if (!databaseClient) return jobs;
  const result = await databaseClient.from("render_jobs").select(SUPABASE_RENDER_JOB_COLUMNS).order("created_at", { ascending: false });
  if (result.error) return jobs;
  const byId = new Map(jobs.map((job) => [job.jobId, job]));
  for (const row of result.data ?? []) {
    const job = fromSupabaseRow(row);
    if (!byId.has(job.jobId)) jobs.push(job);
  }
  return jobs.sort((left, right) => right.createdAt - left.createdAt);
}

export async function findJobByIdempotencyKey(
  key: string,
): Promise<PersistentRenderJob | null> {
  const index = await readIdempotencyIndex();
  const jobId = index[key];
  if (jobId) return getRenderJob(jobId);
  const client = createRenderDatabaseClient();
  if (!client) return null;
  const result = await client.from("render_jobs").select(SUPABASE_RENDER_JOB_COLUMNS).eq("idempotency_key", key).maybeSingle();
  if (result.error || !result.data) return null;
  return fromSupabaseRow(result.data);
}

/** MVP renders as a single Cloud Run job; the chunk manifest is a draft coordinator contract, not yet part of the real render flow. */
function isChunkExecutionEnabled(): boolean {
  return process.env.RENDER_DISPATCH_MODE?.trim().toLowerCase() === "cloud-run-job"
    && process.env.RENDER_CHUNK_EXECUTION_ENABLED?.trim().toLowerCase() === "true";
}

export async function createRenderJob(input: {
  userId: string;
  projectId: string;
  projectRevision: number;
  idempotencyKey: string;
  database?: {
    workspaceId: string;
    revisionId: string;
    preset: string;
    runtime: RuntimeProjectV3;
  };
}): Promise<{ job: PersistentRenderJob; created: boolean }> {
  if (input.database) {
    const client = createRenderDatabaseClient();
    if (!client) throw new Error("Supabase is required for database-backed render jobs");
    const existing = await client.from("render_jobs").select(SUPABASE_RENDER_JOB_COLUMNS).eq("workspace_id", input.database.workspaceId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existing.error) throw new Error(`Unable to read render job: ${existing.error.message}`);
    if (existing.data) {
      const job = fromSupabaseRow(existing.data);
      if (!existing.data.runtime_json && !existing.data.runtime_manifest_chunk_count) {
        await persistLargeRuntimeManifest(job.jobId, input.database.runtime);
      }
      if (isChunkExecutionEnabled() && !job.chunkManifestChecksum) {
        await initializeRenderJobChunks(job.jobId, input.database.runtime);
      }
      return { job: (await getRenderJob(job.jobId)) ?? job, created: false };
    }

    const publicRef = `rnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const runtimePayload = runtimeManifestBytes(input.database.runtime);
    const inlineLimit = Math.max(64 * 1024, Number(process.env.RENDER_RUNTIME_INLINE_MAX_BYTES ?? DEFAULT_INLINE_RUNTIME_MAX_BYTES));
    const useLargeManifestUpload = runtimePayload.byteLength > inlineLimit;
    const inserted = await client.from("render_jobs").insert({
      public_ref: publicRef,
      workspace_id: input.database.workspaceId,
      project_id: input.projectId,
      revision_id: input.database.revisionId,
      status: "queued",
      preset_json: { preset: input.database.preset, projectRevision: input.projectRevision },
      idempotency_key: input.idempotencyKey,
      runtime_json: useLargeManifestUpload ? null : input.database.runtime,
      heartbeat_at: null,
      lease_owner: null,
      attempt_count: 0,
      cancel_requested: false,
      progress: 0,
      stage: "queued",
      metrics_json: {},
      created_by: input.userId,
    }).select(SUPABASE_RENDER_JOB_COLUMNS).single();
    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === "23505") {
        const raced = await client.from("render_jobs").select(SUPABASE_RENDER_JOB_COLUMNS).eq("workspace_id", input.database.workspaceId).eq("idempotency_key", input.idempotencyKey).single();
        if (raced.error || !raced.data) throw new Error(`Unable to resolve render job race: ${raced.error?.message ?? "missing row"}`);
        return { job: fromSupabaseRow(raced.data), created: false };
      }
      throw new Error(`Unable to create render job: ${inserted.error?.message ?? "missing row"}`);
    }
    const job = fromSupabaseRow(inserted.data);
    if (useLargeManifestUpload) {
      await persistLargeRuntimeManifest(job.jobId, input.database.runtime);
    }
    if (isChunkExecutionEnabled()) {
      await initializeRenderJobChunks(job.jobId, input.database.runtime);
    }
    return { job: (await getRenderJob(job.jobId)) ?? job, created: true };
  }

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
    const raced = await getRenderJob(index[input.idempotencyKey]);
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
  if (await hasLocalRenderJob(jobId)) {
    await saveRenderJob(next);
    return next;
  }

  const client = createRenderDatabaseClient();
  if (!client) return null;
  const result = await client.from("render_jobs").update({
    status: next.status,
    progress: next.progress,
    stage: next.stage ?? null,
    error_code: next.error ?? null,
    output_key: next.outputKey ?? null,
    artifact_path: next.artifactPath ?? null,
    metrics_json: next.metrics ?? {},
    updated_at: new Date(next.updatedAt).toISOString(),
    finished_at: ["done", "failed", "cancelled"].includes(next.status) ? new Date(next.updatedAt).toISOString() : null,
    heartbeat_at: next.heartbeatAt ? new Date(next.heartbeatAt).toISOString() : null,
    lease_owner: next.leaseOwner ?? null,
    attempt_count: next.attemptCount ?? 0,
    cancel_requested: next.cancelRequested ?? false,
  }).eq("public_ref", jobId).select(SUPABASE_RENDER_JOB_COLUMNS).maybeSingle();
  if (result.error || !result.data) return null;
  return fromSupabaseRow(result.data);
}

export async function claimRenderJob(
  jobId: string,
  workerId: string,
  staleAfterSeconds: number,
): Promise<PersistentRenderJob | null> {
  const client = createRenderDatabaseClient();
  if (!client) return null;
  const result = await client.rpc("render_job_claim", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_stale_after_seconds: Math.max(60, Math.floor(staleAfterSeconds)),
  });
  if (result.error || !result.data) return null;
  return fromSupabaseRow(result.data as SupabaseRenderJobRow);
}

export async function touchRenderJobLease(
  jobId: string,
  workerId: string,
): Promise<boolean> {
  const client = createRenderDatabaseClient();
  if (!client) return false;
  const result = await client.rpc("render_job_touch_lease", {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  return !result.error && result.data === true;
}

export async function releaseRenderJobLease(
  jobId: string,
  workerId: string,
  nextStatus?: RenderJobStatus,
): Promise<void> {
  const client = createRenderDatabaseClient();
  if (!client) return;
  const update: Record<string, unknown> = {
    lease_owner: null,
    heartbeat_at: null,
    updated_at: new Date().toISOString(),
  };
  if (nextStatus) {
    update.status = nextStatus;
    update.stage = nextStatus === "queued" ? "queue-retry" : nextStatus;
    if (nextStatus === "cancelled") update.finished_at = new Date().toISOString();
  }
  await client.from("render_jobs").update(update).eq("public_ref", jobId).eq("lease_owner", workerId);
}

export async function recoverStaleRenderJobs(staleAfterSeconds: number): Promise<string[]> {
  const client = createRenderDatabaseClient();
  if (!client) return [];
  const result = await client.rpc("render_jobs_recover_stale", {
    p_stale_after_seconds: Math.max(60, Math.floor(staleAfterSeconds)),
  });
  const recovered = result.data as unknown;
  if (result.error || !Array.isArray(recovered)) return [];
  return recovered
    .filter(isRecoveredRenderJob)
    .filter((item) => item.status === "queued")
    .map((item) => item.jobId);
}

export async function getRenderJobRuntime(jobId: string): Promise<RuntimeProjectV3 | null> {
  const client = createRenderDatabaseClient();
  if (!client) return null;
  const result = await client.from("render_jobs").select("id, runtime_json, runtime_manifest_chunk_count, runtime_manifest_sha256").eq("public_ref", jobId).maybeSingle();
  if (result.error || !result.data) return null;
  if (result.data.runtime_json) return result.data.runtime_json as RuntimeProjectV3;
  const chunkCount = Number(result.data.runtime_manifest_chunk_count ?? 0);
  if (chunkCount > 0) {
    const chunks: Buffer[] = [];
    const digest = createHash("sha256");
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = await client.rpc("render_job_runtime_manifest_get_chunk", { p_job_id: result.data.id, p_chunk_index: index });
      if (chunk.error) return null;
      const item = Array.isArray(chunk.data) ? chunk.data[0] : chunk.data;
      if (!item || typeof item !== "object" || typeof (item as { payload_base64?: unknown }).payload_base64 !== "string") return null;
      const payload = Buffer.from((item as { payload_base64: string }).payload_base64, "base64");
      digest.update(payload);
      chunks.push(payload);
    }
    const expectedSha256 = typeof result.data.runtime_manifest_sha256 === "string" ? result.data.runtime_manifest_sha256.trim().toLowerCase() : "";
    if (expectedSha256 && digest.digest("hex") !== expectedSha256) return null;
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as RuntimeProjectV3;
    } catch {
      return null;
    }
  }
  const legacy = await client.from("render_jobs").select("runtime_manifest_text").eq("public_ref", jobId).maybeSingle();
  if (legacy.error || !legacy.data?.runtime_manifest_text) return null;
  try {
    return JSON.parse(legacy.data.runtime_manifest_text) as RuntimeProjectV3;
  } catch {
    return null;
  }
}

/**
 * Persist the Phase 5.1 manifest before dispatching work. The database RPC
 * locks the parent row and inserts all chunk rows atomically. The current
 * renderer still consumes the parent runtime sequentially; these rows are
 * the immutable coordinator contract for the upcoming indexed workers.
 */
export async function initializeRenderJobChunks(
  jobId: string,
  runtime: RuntimeProjectV3,
  options: RenderChunkManifestOptions = {},
): Promise<RenderChunkManifest> {
  const client = createRenderDatabaseClient();
  if (!client) throw new Error("Supabase is required to initialize render chunks");
  const manifest = buildRenderChunkManifest(runtime, options);
  assertContiguousRenderChunkManifest(manifest);
  const parent = await client
    .from("render_jobs")
    .select("id")
    .eq("public_ref", jobId)
    .single();
  if (parent.error || !parent.data) {
    throw new Error(`Unable to resolve render job for chunk manifest: ${parent.error?.message ?? "missing row"}`);
  }
  const chunks = manifest.chunks.map((chunk) => ({
    chunk_index: chunk.chunkIndex,
    start_frame: chunk.startFrame,
    end_frame_exclusive: chunk.endFrameExclusive,
    attempt: chunk.attempt,
    status: "queued",
    runtime_checksum: manifest.runtimeChecksum,
    asset_versions_json: manifest.assetVersions,
    metrics_json: {},
  }));
  const result = await client.rpc("render_job_initialize_chunks", {
    p_job_id: parent.data.id,
    p_manifest: manifest,
    p_manifest_checksum: manifest.checksum,
    p_chunk_size: manifest.chunkSize,
    p_chunk_count: manifest.chunks.length,
    p_chunk_parallelism: manifest.parallelism,
    p_chunks: chunks,
  });
  if (result.error) {
    throw new Error(`Unable to initialize render chunks: ${result.error.message}`);
  }
  return manifest;
}

export type RenderJobChunkSummary = {
  chunkCount: number;
  queued: number;
  running: number;
  verified: number;
  failed: number;
  cancelled: number;
};

export async function getRenderJobChunkSummary(jobId: string): Promise<RenderJobChunkSummary | null> {
  const client = createRenderDatabaseClient();
  if (!client) return null;
  const parent = await client.from("render_jobs").select("id, chunk_count").eq("public_ref", jobId).maybeSingle();
  if (parent.error || !parent.data) return null;
  const rows = await client.from("render_job_chunks").select("chunk_index, attempt, status").eq("render_job_id", parent.data.id);
  if (rows.error) return null;
  const summary: RenderJobChunkSummary = { chunkCount: Number(parent.data.chunk_count ?? 0), queued: 0, running: 0, verified: 0, failed: 0, cancelled: 0 };
  const latestByChunk = new Map<number, { attempt: number; status: string }>();
  for (const row of rows.data ?? []) {
    const chunkIndex = Number(row.chunk_index);
    const attempt = Number(row.attempt);
    const current = latestByChunk.get(chunkIndex);
    if (!current || attempt > current.attempt) latestByChunk.set(chunkIndex, { attempt, status: String(row.status) });
  }
  for (const row of latestByChunk.values()) {
    if (row.status === "queued") summary.queued += 1;
    else if (row.status === "running") summary.running += 1;
    else if (row.status === "verified") summary.verified += 1;
    else if (row.status === "failed") summary.failed += 1;
    else if (row.status === "cancelled") summary.cancelled += 1;
  }
  return summary;
}

export async function recoverStaleRenderJobChunks(jobId: string, staleAfterSeconds: number): Promise<number> {
  const client = createRenderDatabaseClient();
  if (!client) return 0;
  const result = await client.rpc("render_job_chunks_recover_stale", {
    p_job_id: jobId,
    p_stale_after_seconds: Math.max(60, Math.floor(staleAfterSeconds)),
  });
  if (result.error || !Array.isArray(result.data)) return 0;
  return result.data.length;
}

export async function recoverStaleRenderFinalizer(
  jobId: string,
  staleAfterSeconds: number,
  maxAttempts: number,
): Promise<{ state: string; attemptCount?: number }> {
  const client = createRenderDatabaseClient();
  if (!client) return { state: "disabled" };
  const result = await client.rpc("render_job_finalizer_recover_stale", {
    p_job_id: jobId,
    p_stale_after_seconds: Math.max(60, Math.floor(staleAfterSeconds)),
    p_max_attempts: Math.max(1, Math.floor(maxAttempts)),
  });
  if (result.error || !result.data || typeof result.data !== "object") {
    throw new Error(`Unable to recover stale finalizer: ${result.error?.message ?? "invalid response"}`);
  }
  const data = result.data as Record<string, unknown>;
  return {
    state: typeof data.state === "string" ? data.state : "unknown",
    ...(typeof data.attemptCount === "number" ? { attemptCount: data.attemptCount } : {}),
  };
}

/**
 * The job's creator always has access. For database-backed jobs, any other
 * member of the job's workspace (owner/editor/viewer) also has access -
 * renders belong to the workspace, not only to whoever happened to start
 * them, matching how projects/assets are shared within a team workspace.
 * Local file-backed jobs (no workspaceId) fall back to creator-only.
 */
export async function assertJobAccess(
  job: PersistentRenderJob,
  userId: string,
): Promise<void> {
  if (job.userId === userId) return;
  if (!job.workspaceId) throw new Error("FORBIDDEN_JOB_ACCESS");
  const client = createRenderDatabaseClient();
  if (!client) throw new Error("FORBIDDEN_JOB_ACCESS");
  const membership = await client
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", job.workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membership.error || !membership.data) throw new Error("FORBIDDEN_JOB_ACCESS");
}
