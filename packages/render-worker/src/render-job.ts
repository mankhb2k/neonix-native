import { createReadStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { renderRuntimeProjectV3, verifyRenderOutput } from "@motionvideo/render-native";

// The Cloud Run Job entrypoint for the (non-chunked) render pipeline. Owns
// everything that isn't "render a manifest to an MP4": claiming/leasing the
// render_jobs row, writing progress, publishing the artifact to R2. Actual
// rendering (and verifying the render's own output) is delegated to
// @motionvideo/render-native, which knows nothing about Postgres, queues, or
// job records - see that package's own README for why this split exists
// (render-native was doing all three jobs at once before this refactor).
//
// Uses plain `pg` against the API database - the worker's other legacy
// entrypoints are outside the active render path. The chunked-render feature is
// unshipped/unused in every environment (RENDER_CHUNK_EXECUTION_ENABLED is
// false everywhere), so porting it wasn't part of this move.

type RenderJobRow = {
  id: string;
  public_ref: string;
  workspace_id: string;
  created_by: string;
  output_key: string | null;
  status: string;
  attempt_count: number;
  cancel_requested: boolean;
  runtime_json: RuntimeProjectV3 | null;
};

const RENDER_JOB_COLUMNS = "id, public_ref, workspace_id, created_by, output_key, status, attempt_count, cancel_requested, runtime_json";

function parseRuntimeManifest(row: RenderJobRow): RuntimeProjectV3 | null {
  return row.runtime_json;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function createDatabase(): Pool {
  return new Pool({ connectionString: requiredEnv("DATABASE_URL") });
}

function workerId(): string {
  const execution = process.env.CLOUD_RUN_EXECUTION?.trim() || "local";
  const task = process.env.CLOUD_RUN_TASK_INDEX?.trim() || "0";
  return `render-job:${execution}:${task}:${hostname()}:${process.pid}`;
}

function safeObjectKey(value: string): string {
  const key = value.replaceAll("\\", "/").trim();
  if (!key || key.startsWith("/") || key.includes("..") || key.startsWith("__tmp__/")) {
    throw new Error("Invalid render output key");
  }
  return key;
}

function outputKeyFor(job: RenderJobRow): string {
  return safeObjectKey(job.output_key ?? `${job.created_by}/${job.public_ref}.mp4`);
}

function createR2Client(): { client: S3Client; bucket: string } {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = process.env.R2_USER_EXPORTS_BUCKET?.trim() || requiredEnv("R2_BUCKET");
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    }),
  };
}

async function publishArtifact(filePath: string, finalKey: string): Promise<{ bytes: number; bucket: string }> {
  const { client, bucket } = createR2Client();
  const details = await stat(filePath);
  const temporaryKey = `__tmp__/render/${finalKey}.attempt-${process.env.CLOUD_RUN_EXECUTION?.trim() || Date.now().toString(36)}`;
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: temporaryKey,
      Body: createReadStream(filePath),
      ContentLength: details.size,
      ContentType: "video/mp4",
    }));
    const uploaded = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: temporaryKey }));
    if ((uploaded.ContentLength ?? -1) !== details.size) {
      throw new Error(`R2 temporary artifact size mismatch: expected ${details.size}, got ${uploaded.ContentLength ?? "missing"}`);
    }
    await client.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: encodeURIComponent(`${bucket}/${temporaryKey}`),
      Key: finalKey,
      ContentType: "video/mp4",
      MetadataDirective: "REPLACE",
    }));
    const finalObject = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: finalKey }));
    if ((finalObject.ContentLength ?? -1) !== details.size) {
      throw new Error(`R2 final artifact size mismatch: expected ${details.size}, got ${finalObject.ContentLength ?? "missing"}`);
    }
    return { bytes: details.size, bucket };
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: temporaryKey })).catch(() => undefined);
  }
}

// Replaces the previous chained update/select calls - same
// lease-guarded write (only succeeds if `worker` still holds the lease).
// jsonb-typed patch values (metrics_json etc.) must be JSON-encoded and cast
// explicitly; `pg` does not auto-serialize objects into jsonb params.
export async function updateJob(
  database: Pool,
  jobId: string,
  worker: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const values: unknown[] = [jobId, worker];
  const assignments = keys.map((key) => {
    const value = patch[key];
    values.push(value !== null && typeof value === "object" ? JSON.stringify(value) : value);
    const isJsonColumn = value !== null && typeof value === "object";
    return `${key} = $${values.length}${isJsonColumn ? "::jsonb" : ""}`;
  });
  assignments.push("updated_at = now()");
  const result = await database.query(
    `update render_jobs set ${assignments.join(", ")} where public_ref = $1 and lease_owner = $2 returning public_ref`,
    values,
  );
  console.log(JSON.stringify({ diag: "updateJob:done", atMs: Date.now(), keys, matchedRows: result.rowCount }));
  if (result.rowCount === 0) throw new Error(`Unable to update render job ${jobId}: no row matched (lease no longer held by ${worker}?)`);
}

export async function loadJob(database: Pool, jobId: string): Promise<RenderJobRow | null> {
  const result = await database.query<RenderJobRow>(
    `select ${RENDER_JOB_COLUMNS} from render_jobs where public_ref = $1`,
    [jobId],
  );
  return result.rows[0] ?? null;
}

// Replaces the `render_job_claim` Postgres function with the identical
// compare-and-swap logic inline: claimable only while not cancelled, not in
// a terminal state, and either unleased or the existing lease is stale.
export async function claimJob(database: Pool, jobId: string, worker: string): Promise<RenderJobRow | null> {
  const staleAfterSeconds = Math.max(60, Number(process.env.RENDER_JOB_STALE_AFTER_SECONDS ?? 1800));
  const result = await database.query<RenderJobRow>(
    `update render_jobs
        set lease_owner = $2,
            heartbeat_at = now(),
            attempt_count = attempt_count + 1,
            status = case when status = 'queued' then 'planning' else status end,
            stage = case when status = 'queued' then 'planning' else stage end,
            updated_at = now()
      where public_ref = $1
        and cancel_requested = false
        and status not in ('done', 'failed', 'cancelled')
        and (lease_owner is null or heartbeat_at is null or heartbeat_at < now() - make_interval(secs => greatest($3, 60)))
      returning ${RENDER_JOB_COLUMNS}`,
    [jobId, worker, staleAfterSeconds],
  );
  return result.rows[0] ?? null;
}

export async function releaseLease(database: Pool, jobId: string, worker: string, status: "queued" | "done" | "failed" | "cancelled"): Promise<void> {
  await database.query(
    `update render_jobs
        set status = $3,
            stage = case when $3 = 'queued' then 'queue-retry' else $3 end,
            lease_owner = null,
            heartbeat_at = null,
            finished_at = case when $3 = 'queued' then null else now() end,
            updated_at = now()
      where public_ref = $1 and lease_owner = $2`,
    [jobId, worker, status],
  );
}

// Replaces the `render_job_touch_lease` Postgres function.
export async function touchLease(database: Pool, jobId: string, worker: string): Promise<void> {
  await database.query(
    `update render_jobs
        set heartbeat_at = now(), updated_at = now()
      where public_ref = $1 and lease_owner = $2
        and status not in ('done', 'failed', 'cancelled') and cancel_requested = false`,
    [jobId, worker],
  );
}

async function main(): Promise<void> {
  const jobId = requiredEnv("RENDER_JOB_ID");
  const worker = workerId();
  const database = createDatabase();
  try {
    await runJob(database, jobId, worker);
  } finally {
    await database.end();
  }
}

async function runJob(database: Pool, jobId: string, worker: string): Promise<void> {
  const existing = await loadJob(database, jobId);
  if (!existing) throw new Error(`Render job not found: ${jobId}`);
  if (existing.status === "done" || existing.status === "cancelled") {
    console.log(JSON.stringify({ ok: true, jobId, status: existing.status, idempotent: true }));
    return;
  }
  const job = await claimJob(database, jobId, worker);
  if (!job) {
    const current = await loadJob(database, jobId);
    if (current?.status === "done" || current?.status === "cancelled") {
      console.log(JSON.stringify({ ok: true, jobId, status: current.status, idempotent: true }));
      return;
    }
    throw new Error(`Render job is not claimable: ${jobId}`);
  }
  const runtime = parseRuntimeManifest(job);
  if (job.cancel_requested || !runtime) {
    await releaseLease(database, jobId, worker, job.cancel_requested ? "cancelled" : "failed");
    throw new Error(job.cancel_requested ? "Render was cancelled." : "Render job has no immutable runtime manifest.");
  }

  const startedAt = Date.now();
  const scratchRoot = resolve(process.env.EXPORT_RENDERER_OUTPUT_ROOT?.trim() || "/tmp/neonix-export");
  const scratchDir = join(scratchRoot, jobId, `attempt-${job.attempt_count}`);
  const outputPath = join(scratchDir, "render.mp4");
  await mkdir(dirname(outputPath), { recursive: true });
  const heartbeat = setInterval(() => {
    void touchLease(database, jobId, worker);
  }, 30_000);
  heartbeat.unref();
  let progressTail = Promise.resolve();
  let lastProgressAt = 0;
  try {
    await updateJob(database, jobId, worker, { status: "planning", stage: "planning", progress: 0.02 });
    const expectedFrames = Math.max(1, Math.ceil((runtime.visual.composition.duration ?? 1) * runtime.visual.composition.fps));
    const expectedAudio = runtime.audioTimeline.tracks.some((track) => track.clips.length > 0);
    const stats = await renderRuntimeProjectV3(runtime, {
      outputPath,
      parallelism: 1,
      onProgress: (event) => {
        const now = Date.now();
        if (now - lastProgressAt < 1000 && event.completedFrames < event.totalFrames) return;
        lastProgressAt = now;
        progressTail = progressTail.then(() => updateJob(database, jobId, worker, {
          status: event.stage,
          stage: event.stage,
          progress: event.stage === "rendering" ? 0.05 + (event.completedFrames / Math.max(1, event.totalFrames)) * 0.8 : 0.88,
        }));
      },
    });
    await progressTail;
    await updateJob(database, jobId, worker, { status: "publishing", stage: "publishing", progress: 0.94 });
    const verified = await verifyRenderOutput(outputPath, expectedFrames, expectedAudio);
    const published = await publishArtifact(outputPath, outputKeyFor(job));
    await updateJob(database, jobId, worker, {
      status: "done",
      stage: "done",
      progress: 1,
      output_key: outputKeyFor(job),
      artifact_path: `r2://${published.bucket}/${outputKeyFor(job)}`,
      metrics_json: {
        framesRendered: verified.frames,
        outputSizeInBytes: verified.bytes,
        verifiedFrames: verified.frames,
        verifiedDurationSeconds: verified.durationSeconds,
        verifiedCodec: verified.codec,
        audioStreams: verified.audioStreams,
        renderMilliseconds: stats.renderMilliseconds,
        encodeMilliseconds: stats.encodeMilliseconds,
        backendIdentity: stats.backendIdentity,
        scheduler: stats.scheduler,
        encodeBreakdown: stats.encodeBreakdown,
        renderBreakdown: stats.renderBreakdown,
        wallClockMilliseconds: Date.now() - startedAt,
        imageDigest: process.env.IMAGE_DIGEST?.trim() || null,
        gitSha: process.env.GIT_SHA?.trim() || null,
      },
      lease_owner: null,
      heartbeat_at: null,
      finished_at: new Date().toISOString(),
    });
    console.log(JSON.stringify({ ok: true, jobId, status: "done", outputKey: outputKeyFor(job), bytes: published.bytes, imageDigest: process.env.IMAGE_DIGEST?.trim() || null }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(database, jobId, worker, { error_code: message, progress: 0 });
    await releaseLease(database, jobId, worker, "queued");
    console.error(JSON.stringify({ ok: false, jobId, status: "queued", error: message }));
    throw error;
  } finally {
    clearInterval(heartbeat);
    await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// Guarded so this module can be imported (e.g. to test the DB layer's
// exported functions directly) without also kicking off a real render.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({ marker: "render-job-started", atMs: Date.now() }));
  await main();
}
