import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { hostname } from "node:os";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { resolveProjectAudioMix } from "./render/audio-filter";
import { concatMp4Segments, muxVideoWithAudio } from "./render/ffmpeg";
import { computeRuntimeHash } from "./contracts";
import { errorMessage, isRetryableRenderError, retryBudgetFromEnv } from "./retry-policy";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { loadRuntimeManifest } from "./runtime-manifest";

type Job = { id: string; public_ref: string; created_by: string; workspace_id: string; output_key: string | null; runtime_json: RuntimeProjectV3 | null; runtime_manifest_text?: string | null; runtime_manifest_chunk_count?: number | null; runtime_manifest_sha256?: string | null; chunk_count: number; attempt_count?: number };
type Chunk = { chunk_index: number; attempt: number; start_frame: number; end_frame_exclusive: number; status: string; segment_key: string | null; output_checksum: string | null; runtime_checksum: string };

function requiredEnv(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`Missing ${name}`); return value; }
function database(): SupabaseClient { return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } }); }
function r2(): { client: S3Client; bucket: string } {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = process.env.R2_USER_EXPORTS_BUCKET?.trim() || requiredEnv("R2_BUCKET");
  return { client: new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY") } }), bucket };
}
function workerId(): string { return `render-finalizer:${process.env.CLOUD_RUN_EXECUTION?.trim() || "local"}:${hostname()}:${process.pid}`; }
function runProcess(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); }); child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", reject); child.once("close", (code) => resolveProcess({ code: code ?? 1, stdout, stderr }));
  });
}
async function checksum(filePath: string): Promise<string> { const hash = createHash("sha256"); await new Promise<void>((resolveHash, reject) => { const stream = createReadStream(filePath); stream.on("data", (chunk: string | Buffer) => { hash.update(chunk); }); stream.once("error", reject); stream.once("end", resolveHash); }); return hash.digest("hex"); }
async function downloadObject(client: S3Client, bucket: string, key: string, target: string): Promise<void> { const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })); if (!result.Body) throw new Error(`R2 segment has no body: ${key}`); await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(target)); }
async function verifyOutput(filePath: string, expectedFrames: number, expectedAudio: boolean): Promise<{ frames: number; durationSeconds: number; codec: string; audioStreams: number; bytes: number; checksum: string }> {
  const probe = await runProcess(process.env.FFPROBE_PATH?.trim() || "ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_type,codec_name,nb_read_frames,duration:format=duration", "-of", "json", filePath]);
  if (probe.code !== 0) throw new Error(`FINAL_VERIFY_FAILED: ${probe.stderr.trim()}`);
  const parsed = JSON.parse(probe.stdout) as { streams?: Array<{ codec_type?: string; codec_name?: string; nb_read_frames?: string }>; format?: { duration?: string } };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video"); const audio = parsed.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  const frames = Number(video?.nb_read_frames ?? 0); const durationSeconds = Number(parsed.format?.duration ?? 0);
  if (!video?.codec_name || frames !== expectedFrames || !(durationSeconds > 0) || (expectedAudio && audio.length !== 1)) throw new Error(`FINAL_VERIFY_FAILED: frames=${frames}/${expectedFrames} duration=${durationSeconds} audio=${audio.length}`);
  return { frames, durationSeconds, codec: video.codec_name, audioStreams: audio.length, bytes: (await stat(filePath)).size, checksum: await checksum(filePath) };
}
// Chunk segments (renders/{jobId}/segments/chunk-N.mp4) are scratch inputs to
// the merge above; once the merged, verified output is durably committed as
// `status: "done"`, they serve no further purpose and must not be left in R2
// indefinitely. Best-effort: a failed cleanup is logged, not fatal - the
// finished render must not be rolled back over leftover scratch objects.
async function deleteSegments(segmentKeys: string[]): Promise<void> {
  if (segmentKeys.length === 0) return;
  const { client, bucket } = r2();
  try {
    const batches: string[][] = [];
    for (let index = 0; index < segmentKeys.length; index += 1000) batches.push(segmentKeys.slice(index, index + 1000));
    for (const batch of batches) {
      const result = await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((key) => ({ Key: key })), Quiet: true } }));
      if (result.Errors && result.Errors.length > 0) {
        console.error(JSON.stringify({ ok: false, warning: "SEGMENT_CLEANUP_PARTIAL", errors: result.Errors }));
      }
    }
  } catch (error) {
    console.error(JSON.stringify({ ok: false, warning: "SEGMENT_CLEANUP_FAILED", error: errorMessage(error) }));
  } finally {
    client.destroy();
  }
}

async function publish(filePath: string, key: string): Promise<{ bucket: string; bytes: number }> {
  const { client, bucket } = r2(); const bytes = (await stat(filePath)).size; const temporaryKey = `__tmp__/render/${key}.finalizer-${process.env.CLOUD_RUN_EXECUTION?.trim() || Date.now().toString(36)}`;
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: temporaryKey, Body: createReadStream(filePath), ContentLength: bytes, ContentType: "video/mp4" }));
    const temporary = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: temporaryKey })); if ((temporary.ContentLength ?? -1) !== bytes) throw new Error("PUBLISH_CONFLICT: temporary artifact size mismatch");
    await client.send(new CopyObjectCommand({ Bucket: bucket, CopySource: encodeURIComponent(`${bucket}/${temporaryKey}`), Key: key, ContentType: "video/mp4", MetadataDirective: "REPLACE" }));
    const final = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); if ((final.ContentLength ?? -1) !== bytes) throw new Error("PUBLISH_CONFLICT: final artifact size mismatch");
    return { bucket, bytes };
  } finally { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: temporaryKey })).catch(() => undefined); client.destroy(); }
}

async function main(): Promise<void> {
  const jobId = requiredEnv("RENDER_JOB_ID");
  const terminationController = new AbortController();
  const onTerminate = (signal: NodeJS.Signals): void => {
    if (!terminationController.signal.aborted) {
      terminationController.abort(new Error(`WORKER_${signal}: finalizer interrupted`));
    }
  };
  const onSigterm = (): void => onTerminate("SIGTERM");
  const onSigint = (): void => onTerminate("SIGINT");
  process.once("SIGTERM", onSigterm);
  process.once("SIGINT", onSigint);
  const db = database(); const worker = workerId();
  const claim = await db.rpc("render_job_finalizer_claim", { p_job_id: jobId, p_worker_id: worker, p_stale_after_seconds: Number(process.env.RENDER_JOB_STALE_AFTER_SECONDS ?? 1800) });
  if (claim.error) throw new Error(`Unable to claim finalizer: ${claim.error.message}`);
  const claimed = claim.data as { state?: string; job?: Job } | null;
  if (!claimed || claimed.state === "waiting" || claimed.state === "busy") { console.log(JSON.stringify({ ok: true, jobId, state: claimed?.state ?? "missing" })); return; }
  if (claimed.state === "done") { console.log(JSON.stringify({ ok: true, jobId, state: "done", idempotent: true })); return; }
  if (claimed.state !== "claimed" || !claimed.job) throw new Error("Finalizer claim did not return a job");
  const job = claimed.job; const parent = await db.from("render_jobs").select("id, output_key, runtime_json, runtime_manifest_chunk_count, runtime_manifest_sha256, chunk_count").eq("public_ref", jobId).single();
  if (parent.error || !parent.data) throw new Error(`Unable to load finalizer job: ${parent.error?.message ?? "missing"}`);
  const chunksResult = await db.from("render_job_chunks").select("chunk_index, attempt, start_frame, end_frame_exclusive, status, segment_key, output_checksum, runtime_checksum").eq("render_job_id", parent.data.id).order("chunk_index", { ascending: true }).order("attempt", { ascending: false });
  if (chunksResult.error) throw new Error(`Unable to load chunks: ${chunksResult.error.message}`);
  const latestByChunk = new Map<number, Chunk>();
  for (const row of (chunksResult.data ?? []) as Chunk[]) {
    if (!latestByChunk.has(row.chunk_index)) latestByChunk.set(row.chunk_index, row);
  }
  const chunks = [...latestByChunk.values()].sort((left, right) => left.chunk_index - right.chunk_index);
  const runtime = await loadRuntimeManifest(db, { ...parent.data, id: parent.data.id });
  if (!runtime) throw new Error("Finalizer job has no valid immutable runtime manifest");
  const runtimeChecksum = computeRuntimeHash(runtime as unknown as Record<string, unknown>);
  if (chunks.length !== Number(parent.data.chunk_count ?? 0) || chunks.some((chunk) => chunk.status !== "verified" || !chunk.segment_key)) throw new Error("FINALIZER_NOT_READY: not all chunks are verified");
  if (chunks.some((chunk) => chunk.runtime_checksum !== runtimeChecksum)) throw new Error("RUNTIME_CHECKSUM_MISMATCH: chunk/runtime checksum differs");
  const scratch = resolve(process.env.EXPORT_RENDERER_OUTPUT_ROOT?.trim() || "/tmp/neonix-export", jobId, "finalizer"); const concatPath = join(scratch, "video-only.mp4"); const outputPath = join(scratch, "final.mp4");
  const heartbeat = setInterval(() => {
    void db.rpc("render_job_touch_lease", { p_job_id: jobId, p_worker_id: worker }).then(({ error }) => {
      if (error) console.error(JSON.stringify({ ok: false, jobId, error: `FINALIZER_HEARTBEAT_FAILED: ${error.message}` }));
    });
  }, 30_000);
  heartbeat.unref();
  try {
    await mkdir(scratch, { recursive: true }); const { client, bucket } = r2(); const segmentPaths: string[] = [];
    try { for (const chunk of chunks) { const segmentPath = join(scratch, `chunk-${chunk.chunk_index}.mp4`); await downloadObject(client, bucket, chunk.segment_key as string, segmentPath); segmentPaths.push(segmentPath); } } finally { client.destroy(); }
    await concatMp4Segments({ ffmpegPath: process.env.FFMPEG_PATH?.trim() || "ffmpeg", segmentPaths, outputPath: concatPath, logLevel: "error", signal: terminationController.signal });
    const expectedFrames = chunks[chunks.length - 1]!.end_frame_exclusive; const expectedAudio = runtime.audioTimeline.tracks.some((track) => track.clips.length > 0);
    if (expectedAudio) {
      const audio = await resolveProjectAudioMix(runtime, expectedFrames, runtime.visual.composition.fps, process.env.EXPORT_RENDERER_ASSET_ROOT?.trim() || resolve(process.cwd(), "apps/web/public"));
      if (!audio) throw new Error("AUDIO_TOPOLOGY_MISMATCH: expected audio plan is empty");
      try { await muxVideoWithAudio({ ffmpegPath: process.env.FFMPEG_PATH?.trim() || "ffmpeg", videoPath: concatPath, audioInputs: audio.inputs, audioFilterComplex: audio.filterComplex, outputPath, durationSeconds: expectedFrames / runtime.visual.composition.fps, logLevel: "error", signal: terminationController.signal }); } finally { await audio.cleanup?.(); }
    } else { await pipeline(createReadStream(concatPath), createWriteStream(outputPath)); }
    const verified = await verifyOutput(outputPath, expectedFrames, expectedAudio); const outputKey = job.output_key ?? `${job.workspace_id}/${job.public_ref}.mp4`; const published = await publish(outputPath, outputKey);
    const updated = await db.from("render_jobs").update({ status: "done", stage: "done", progress: 1, output_key: outputKey, artifact_path: `r2://${published.bucket}/${outputKey}`, metrics_json: { verifiedFrames: verified.frames, verifiedDurationSeconds: verified.durationSeconds, verifiedCodec: verified.codec, audioStreams: verified.audioStreams, outputSizeInBytes: published.bytes, outputChecksum: verified.checksum }, lease_owner: null, heartbeat_at: null, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("public_ref", jobId).eq("lease_owner", worker);
    if (updated.error || updated.count === 0) throw new Error(`Unable to commit finalizer result: ${updated.error?.message ?? "lease lost"}`);
    // Only delete scratch segments once the merged output is durably "done" -
    // never before, so a crash between merge and commit still leaves the
    // chunks in place for a retried finalizer to re-download.
    await deleteSegments(chunks.map((chunk) => chunk.segment_key).filter((key): key is string => Boolean(key)));
    console.log(JSON.stringify({ ok: true, jobId, status: "done", outputKey, checksum: verified.checksum, frames: verified.frames, audioStreams: verified.audioStreams }));
  } catch (error) {
    const message = terminationController.signal.aborted
      ? "WORKER_SIGTERM: finalizer interrupted before publish"
      : errorMessage(error);
    const retryBudget = retryBudgetFromEnv("RENDER_FINALIZER_RETRIES", 1);
    const finalizerAttempt = Number(job.attempt_count ?? 0);
    const retryable = isRetryableRenderError(message) && finalizerAttempt < retryBudget;
    await db.from("render_jobs").update({
      status: retryable ? "queued" : "failed",
      stage: retryable ? "finalizer-retry" : "failed",
      error_code: message,
      attempt_count: finalizerAttempt + 1,
      lease_owner: null,
      heartbeat_at: null,
      ...(retryable ? {} : { finished_at: new Date().toISOString() }),
      updated_at: new Date().toISOString(),
    }).eq("public_ref", jobId).eq("lease_owner", worker);
    console.error(JSON.stringify({ ok: false, jobId, error: message, retryable })); throw error;
  } finally { clearInterval(heartbeat); await rm(scratch, { recursive: true, force: true }).catch(() => undefined); process.removeListener("SIGTERM", onSigterm); process.removeListener("SIGINT", onSigint); }
}

await main();
