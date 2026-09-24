import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { renderRuntimeProjectV3 } from "./render/render";

type RenderJobRow = {
  public_ref: string;
  workspace_id: string;
  created_by: string;
  output_key: string | null;
  status: string;
  attempt_count: number;
  cancel_requested: boolean;
  runtime_json: RuntimeProjectV3 | null;
  runtime_manifest_text?: string | null;
};

function parseRuntimeManifest(row: RenderJobRow): RuntimeProjectV3 | null {
  if (row.runtime_json) return row.runtime_json;
  if (!row.runtime_manifest_text) return null;
  try {
    return JSON.parse(row.runtime_manifest_text) as RuntimeProjectV3;
  } catch {
    return null;
  }
}

type VerifiedOutput = {
  bytes: number;
  checksum: string;
  frames: number;
  durationSeconds: number;
  codec: string;
  audioStreams: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function createDatabase(): SupabaseClient {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

async function checksumFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolveHash, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolveHash());
  });
  return hash.digest("hex");
}

async function verifyOutput(filePath: string, expectedFrames: number, expectedAudio: boolean): Promise<VerifiedOutput> {
  const probe = await runProcess(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
    "-v", "error",
    "-count_frames",
    "-show_entries", "stream=codec_type,codec_name,nb_read_frames,duration:format=duration",
    "-of", "json",
    filePath,
  ]);
  if (probe.code !== 0) throw new Error(`ffprobe verification failed: ${probe.stderr.trim()}`);
  const parsed = JSON.parse(probe.stdout) as {
    streams?: Array<{ codec_type?: string; codec_name?: string; nb_read_frames?: string; duration?: string }>;
    format?: { duration?: string };
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  const frames = Number(video?.nb_read_frames ?? 0);
  const durationSeconds = Number(parsed.format?.duration ?? 0);
  const details = await stat(filePath);
  if (!video?.codec_name || frames !== expectedFrames || !Number.isFinite(durationSeconds) || durationSeconds <= 0
    || (expectedAudio && audio.length === 0)) {
    throw new Error(`render output verification mismatch: frames=${frames}/${expectedFrames} duration=${durationSeconds} audio=${audio.length}`);
  }
  return {
    bytes: details.size,
    checksum: await checksumFile(filePath),
    frames,
    durationSeconds,
    codec: video.codec_name,
    audioStreams: audio.length,
  };
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

async function updateJob(
  database: SupabaseClient,
  jobId: string,
  worker: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const result = await database
    .from("render_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("public_ref", jobId)
    .eq("lease_owner", worker);
  if (result.error) throw new Error(`Unable to update render job: ${result.error.message}`);
}

async function loadJob(database: SupabaseClient, jobId: string): Promise<RenderJobRow | null> {
  const result = await database
    .from("render_jobs")
    .select("public_ref, workspace_id, created_by, output_key, status, attempt_count, cancel_requested, runtime_json, runtime_manifest_text")
    .eq("public_ref", jobId)
    .maybeSingle();
  if (result.error) throw new Error(`Unable to load render job: ${result.error.message}`);
  return (result.data as RenderJobRow | null) ?? null;
}

async function claimJob(database: SupabaseClient, jobId: string, worker: string): Promise<RenderJobRow | null> {
  const result = await database.rpc("render_job_claim", {
    p_job_id: jobId,
    p_worker_id: worker,
    p_stale_after_seconds: Number(process.env.RENDER_JOB_STALE_AFTER_SECONDS ?? 1800),
  });
  if (result.error) throw new Error(`Unable to claim render job: ${result.error.message}`);
  return (result.data as RenderJobRow | null) ?? null;
}

async function releaseLease(database: SupabaseClient, jobId: string, worker: string, status: "queued" | "done" | "failed" | "cancelled"): Promise<void> {
  await database.from("render_jobs").update({
    status,
    stage: status === "queued" ? "queue-retry" : status,
    lease_owner: null,
    heartbeat_at: null,
    finished_at: status === "queued" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("public_ref", jobId).eq("lease_owner", worker);
}

async function main(): Promise<void> {
  const jobId = requiredEnv("RENDER_JOB_ID");
  const worker = workerId();
  const database = createDatabase();
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
    void database.rpc("render_job_touch_lease", { p_job_id: jobId, p_worker_id: worker });
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
    const verified = await verifyOutput(outputPath, expectedFrames, expectedAudio);
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

console.log(JSON.stringify({ marker: "render-job-started", atMs: Date.now() }));
await main();
