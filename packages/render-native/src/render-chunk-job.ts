import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { hostname } from "node:os";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { computeRuntimeHash } from "./contracts";
import { errorMessage, isRetryableRenderError, retryBudgetFromEnv } from "./retry-policy";
import { renderFrameRangeToMp4 } from "./render/render";
import type { FrameRange } from "./render/frame-range-scheduler";
import { loadRuntimeManifest } from "./runtime-manifest";

type ChunkRow = {
  id: string;
  chunk_index: number;
  start_frame: number;
  end_frame_exclusive: number;
  attempt: number;
  runtime_checksum: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function database(): SupabaseClient {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
}

function r2(): { client: S3Client; bucket: string } {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = process.env.R2_USER_EXPORTS_BUCKET?.trim() || requiredEnv("R2_BUCKET");
  return {
    client: new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY") } }),
    bucket,
  };
}

function workerId(): string {
  return `render-chunk:${process.env.CLOUD_RUN_EXECUTION?.trim() || "local"}:${process.env.CLOUD_RUN_TASK_INDEX?.trim() || "0"}:${hostname()}:${process.pid}`;
}

async function checksum(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolveHash, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => { hash.update(chunk); });
    stream.once("error", reject);
    stream.once("end", resolveHash);
  });
  return hash.digest("hex");
}

function runProcess(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => resolveProcess({ code: code ?? 1, stdout, stderr }));
  });
}

async function verifySegment(filePath: string, expectedFrames: number): Promise<{ frames: number; durationSeconds: number; bytes: number }> {
  const result = await runProcess(process.env.FFPROBE_PATH?.trim() || "ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_type,nb_read_frames:format=duration", "-of", "json", filePath]);
  if (result.code !== 0) throw new Error(`FRAME_PROBE_FAILED: ${result.stderr.trim()}`);
  const parsed = JSON.parse(result.stdout) as { streams?: Array<{ codec_type?: string; nb_read_frames?: string }>; format?: { duration?: string } };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const frames = Number(video?.nb_read_frames ?? 0);
  const durationSeconds = Number(parsed.format?.duration ?? 0);
  if (!video || frames !== expectedFrames || !(durationSeconds > 0)) throw new Error(`FRAME_COUNT_MISMATCH: ${frames}/${expectedFrames}`);
  return { frames, durationSeconds, bytes: (await stat(filePath)).size };
}

async function uploadSegment(filePath: string, key: string): Promise<{ bucket: string; bytes: number }> {
  const { client, bucket } = r2();
  const details = await stat(filePath);
  const temporaryKey = `__tmp__/render/${key}.attempt-${process.env.CLOUD_RUN_EXECUTION?.trim() || Date.now().toString(36)}`;
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: temporaryKey, Body: createReadStream(filePath), ContentLength: details.size, ContentType: "video/mp4" }));
    const uploaded = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: temporaryKey }));
    if ((uploaded.ContentLength ?? -1) !== details.size) throw new Error(`CHECKSUM_MISMATCH: segment size ${uploaded.ContentLength ?? "missing"}/${details.size}`);
    await client.send(new CopyObjectCommand({ Bucket: bucket, CopySource: encodeURIComponent(`${bucket}/${temporaryKey}`), Key: key, ContentType: "video/mp4", MetadataDirective: "REPLACE" }));
    return { bucket, bytes: details.size };
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: temporaryKey })).catch(() => undefined);
    client.destroy();
  }
}

async function main(): Promise<void> {
  const jobId = requiredEnv("RENDER_JOB_ID");
  const terminationController = new AbortController();
  const onTerminate = (signal: NodeJS.Signals): void => {
    if (!terminationController.signal.aborted) {
      terminationController.abort(new Error(`WORKER_${signal}: render interrupted`));
    }
  };
  const onSigterm = (): void => onTerminate("SIGTERM");
  const onSigint = (): void => onTerminate("SIGINT");
  process.once("SIGTERM", onSigterm);
  process.once("SIGINT", onSigint);
  const taskIndex = Number(process.env.CLOUD_RUN_TASK_INDEX ?? process.env.RENDER_CHUNK_INDEX ?? 0);
  if (!Number.isInteger(taskIndex) || taskIndex < 0) throw new Error("Invalid CLOUD_RUN_TASK_INDEX");
  const db = database();
  const parent = await db.from("render_jobs").select("id, runtime_json, runtime_manifest_chunk_count, runtime_manifest_sha256, chunk_count").eq("public_ref", jobId).maybeSingle();
  const runtime = parent.data ? await loadRuntimeManifest(db, parent.data) : null;
  if (parent.error || !parent.data || !runtime) throw new Error(`Unable to load render job: ${parent.error?.message ?? "missing runtime"}`);
  if (taskIndex >= Number(parent.data.chunk_count ?? 0)) {
    console.log(JSON.stringify({ ok: true, jobId, taskIndex, skipped: true, reason: "task_outside_chunk_count" }));
    return;
  }
  const worker = workerId();
  const claimed = await db.rpc("render_job_chunk_claim", { p_job_id: jobId, p_chunk_index: taskIndex, p_worker_id: worker, p_stale_after_seconds: Number(process.env.RENDER_JOB_STALE_AFTER_SECONDS ?? 1800) });
  if (claimed.error) throw new Error(`Unable to claim chunk: ${claimed.error.message}`);
  const chunk = claimed.data as ChunkRow | null;
  if (!chunk) {
    const current = await db.from("render_job_chunks").select("status, error_code").eq("render_job_id", parent.data.id).eq("chunk_index", taskIndex).order("attempt", { ascending: false }).limit(1).maybeSingle();
    if (current.data?.status === "failed") {
      throw new Error(`CHUNK_NOT_CLAIMABLE: failed${current.data.error_code ? ` (${current.data.error_code})` : ""}`);
    }
    console.log(JSON.stringify({ ok: true, jobId, taskIndex, skipped: true, reason: current.data?.status === "verified" ? "chunk_already_verified" : "chunk_not_claimable" }));
    return;
  }
  const heartbeat = setInterval(() => { void db.rpc("render_job_chunk_touch", { p_chunk_id: chunk.id, p_worker_id: worker }); }, 30_000);
  heartbeat.unref();
  const scratch = resolve(process.env.EXPORT_RENDERER_OUTPUT_ROOT?.trim() || "/tmp/neonix-export", jobId, `chunk-${chunk.chunk_index}-attempt-${chunk.attempt}`);
  const outputPath = join(scratch, "segment.mp4");
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    const runtimeChecksum = computeRuntimeHash(runtime as unknown as Record<string, unknown>);
    if (runtimeChecksum !== chunk.runtime_checksum) {
      throw new Error(`RUNTIME_CHECKSUM_MISMATCH: ${runtimeChecksum}/${chunk.runtime_checksum}`);
    }
    const videoOnly: RuntimeProjectV3 = { ...runtime, audioTimeline: { ...runtime.audioTimeline, tracks: [] } };
    const range: FrameRange = { startFrame: chunk.start_frame, endFrameExclusive: chunk.end_frame_exclusive };
    const stats = await renderFrameRangeToMp4(videoOnly, {
      outputPath,
      renderer: "skia",
      ffmpegLogLevel: "error",
      signal: terminationController.signal,
    }, range);
    const verified = await verifySegment(outputPath, range.endFrameExclusive - range.startFrame);
    const outputChecksum = await checksum(outputPath);
    const segmentKey = `renders/${jobId}/segments/chunk-${chunk.chunk_index}.attempt-${chunk.attempt}.mp4`;
    const published = await uploadSegment(outputPath, segmentKey);
    const updated = await db.from("render_job_chunks").update({ status: "verified", segment_key: segmentKey, output_checksum: outputChecksum, output_size_bytes: published.bytes, verified_frames: verified.frames, metrics_json: { renderMilliseconds: stats.renderMilliseconds, encodeMilliseconds: stats.encodeMilliseconds, durationSeconds: verified.durationSeconds, backendIdentity: stats.backendIdentity, scheduler: stats.scheduler, encodeBreakdown: stats.encodeBreakdown, renderBreakdown: stats.renderBreakdown }, lease_owner: null, heartbeat_at: null, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", chunk.id).eq("lease_owner", worker);
    if (updated.error || updated.count === 0) throw new Error(`Unable to commit verified chunk: ${updated.error?.message ?? "lease lost"}`);
    console.log(JSON.stringify({ ok: true, jobId, chunkIndex: chunk.chunk_index, attempt: chunk.attempt, status: "verified", segmentKey, frames: verified.frames, checksum: outputChecksum }));
  } catch (error) {
    const message = terminationController.signal.aborted
      ? "WORKER_SIGTERM: render interrupted before chunk verification"
      : errorMessage(error);
    const retryBudget = retryBudgetFromEnv("RENDER_JOB_CHUNK_RETRIES", 1);
    const retryable = isRetryableRenderError(message) && chunk.attempt <= retryBudget;
    if (retryable) {
      const retry = await db.rpc("render_job_chunk_retry", { p_chunk_id: chunk.id, p_worker_id: worker });
      if (retry.error) {
        await db.from("render_job_chunks").update({ status: "failed", error_code: `${message}; retry scheduling failed: ${retry.error.message}`, lease_owner: null, heartbeat_at: null, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", chunk.id).eq("lease_owner", worker);
      } else {
        await db.from("render_job_chunks").update({ error_code: message, updated_at: new Date().toISOString() }).eq("id", chunk.id);
      }
    } else {
      await db.from("render_job_chunks").update({ status: "failed", error_code: message, lease_owner: null, heartbeat_at: null, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", chunk.id).eq("lease_owner", worker);
    }
    console.error(JSON.stringify({ ok: false, jobId, chunkIndex: chunk.chunk_index, attempt: chunk.attempt, error: message }));
    throw error;
  } finally {
    clearInterval(heartbeat);
    await rm(scratch, { recursive: true, force: true }).catch(() => undefined);
    process.removeListener("SIGTERM", onSigterm);
    process.removeListener("SIGINT", onSigint);
  }
}

await main();
