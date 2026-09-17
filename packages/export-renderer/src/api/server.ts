import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { renderRuntimeProjectV3 } from "../render/render";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { prepareMediaJob, type MediaPrepareRequest } from "../media/media-worker";
import { FileRenderJobStore, type RendererRenderJob } from "./render-job-store";
import type { ExportRenderStats } from "../render/types";
import { GoogleAuth } from "google-auth-library";

const port = Number(process.env.PORT ?? process.env.EXPORT_RENDERER_PORT ?? 8787);
const workspaceRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const outputRoot = resolve(process.env.EXPORT_RENDERER_OUTPUT_ROOT ?? join(workspaceRoot, "tmp", "export-renderer"));
const renderJobStore = new FileRenderJobStore(resolve(process.env.EXPORT_RENDERER_JOB_ROOT ?? join(outputRoot, "jobs")));
const activeRenderControllers = new Map<string, AbortController>();
const temporaryArtifactTtlMs = Number(process.env.EXPORT_RENDERER_TEMP_TTL_MS ?? 24 * 60 * 60_000);
function isControlPlaneOnly(): boolean {
  return process.env.EXPORT_RENDERER_CONTROL_PLANE_ONLY?.trim() === "1";
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function safeOutputName(name: string | undefined, projectId: string): string {
  const safeName = (name ?? `${projectId}-${Date.now()}.mp4`).replaceAll("\\", "/");
  if (isAbsolute(safeName) || safeName.includes("..") || !safeName.endsWith(".mp4")) throw new Error("outputName must be a relative .mp4 filename");
  return safeName;
}

function localOutputPath(name: string | undefined, projectId: string): { name: string; path: string } {
  const safeName = safeOutputName(name, projectId);
  return { name: safeName, path: join(outputRoot, safeName) };
}

function outputToken(outputName: string): string {
  return Buffer.from(outputName, "utf8").toString("base64url");
}

function outputNameFromToken(token: string): string {
  const outputName = Buffer.from(token, "base64url").toString("utf8");
  return safeOutputName(outputName, "output");
}

function authorizeWorker(request: IncomingMessage): boolean {
  const expected = process.env.INTERNAL_WORKER_TOKEN?.trim();
  if (!expected) return true;
  const supplied = request.headers["x-internal-worker-token"];
  return (Array.isArray(supplied) ? supplied[0] : supplied)?.trim() === expected;
}

function authorizeConfiguredWorker(request: IncomingMessage): boolean {
  const expected = process.env.INTERNAL_WORKER_TOKEN?.trim();
  const supplied = request.headers["x-internal-worker-token"];
  const token = (Array.isArray(supplied) ? supplied[0] : supplied)?.trim();
  return Boolean(expected && token && token === expected);
}

async function submitCloudRunRenderJob(jobId: string, options: { mode?: "sequential" | "chunk" | "finalizer"; taskCount?: number } = {}): Promise<{ name?: string; uid?: string }> {
  const project = process.env.CLOUD_RUN_PROJECT_ID?.trim();
  const region = process.env.CLOUD_RUN_REGION?.trim();
  const jobName = options.mode === "chunk"
    ? process.env.CLOUD_RUN_CHUNK_JOB_NAME?.trim()
    : options.mode === "finalizer"
      ? process.env.CLOUD_RUN_FINALIZER_JOB_NAME?.trim()
      : process.env.CLOUD_RUN_JOB_NAME?.trim();
  if (!project || !region || !jobName) throw new Error("Cloud Run Job configuration is incomplete");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const endpoint = `https://run.googleapis.com/v2/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}/jobs/${encodeURIComponent(jobName)}:run`;
  const taskCount = options.taskCount !== undefined ? Math.max(1, Math.floor(options.taskCount)) : undefined;
  const response = await client.request<{ name?: string; uid?: string }>({
    url: endpoint,
    method: "POST",
    data: {
      overrides: {
        ...(taskCount !== undefined ? { taskCount } : {}),
        containerOverrides: [{ env: [{ name: "RENDER_JOB_ID", value: jobId }, ...(options.mode ? [{ name: "RENDER_JOB_MODE", value: options.mode }] : [])] }],
      },
    },
  });
  return response.data;
}

function outputUrl(outputName: string): string {
  return `/v1/outputs/${outputToken(outputName)}`;
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

async function cleanupExpiredTemporaryArtifacts(directory: string, cutoff: number): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await cleanupExpiredTemporaryArtifacts(entryPath, cutoff);
      continue;
    }
    if (!entry.isFile() || !entry.name.includes(".attempt-") || !entry.name.endsWith(".tmp.mp4")) continue;
    const details = await stat(entryPath).catch(() => null);
    if (details && details.mtimeMs < cutoff) await unlink(entryPath).catch(() => undefined);
  }
}

const temporaryCleanupIntervalMs = Math.min(Math.max(60_000, Math.floor(temporaryArtifactTtlMs / 4)), 60 * 60_000);
const temporaryCleanupTimer = setInterval(() => {
  void cleanupExpiredTemporaryArtifacts(outputRoot, Date.now() - temporaryArtifactTtlMs);
}, temporaryCleanupIntervalMs);
temporaryCleanupTimer.unref();

async function verifyMp4(
  filePath: string,
  expectedFrames: number,
  fps: number,
  expectedAudio: boolean,
): Promise<{
  durationSeconds: number;
  frames: number;
  codec: string;
  audioStreams: number;
  checksum: string;
  bytes: number;
}> {
  const probe = await runProcess(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
    "-v", "error", "-count_frames",
    "-show_entries", "stream=index,codec_type,codec_name,nb_read_frames,duration:format=duration",
    "-of", "json", filePath,
  ]);
  if (probe.code !== 0) throw new Error(`ffprobe verification failed: ${probe.stderr.trim()}`);
  let parsed: {
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      nb_read_frames?: string;
      duration?: string;
    }>;
    format?: { duration?: string };
  };
  try { parsed = JSON.parse(probe.stdout) as typeof parsed; } catch { throw new Error("ffprobe returned invalid JSON"); }
  const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audioStreams = parsed.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  const frames = Number(videoStream?.nb_read_frames ?? 0);
  const durationSeconds = Number(parsed.format?.duration ?? 0);
  const audioDurationSeconds = audioStreams.length > 0 ? Number(audioStreams[0]?.duration ?? 0) : 0;
  if (!videoStream?.codec_name || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || frames !== expectedFrames
    || (expectedAudio && (audioStreams.length === 0 || !Number.isFinite(audioDurationSeconds) || audioDurationSeconds <= 0))) {
    throw new Error(`output verification mismatch: codec=${videoStream?.codec_name ?? "unknown"} duration=${durationSeconds} frames=${frames} expectedFrames=${expectedFrames} fps=${fps} audioStreams=${audioStreams.length} expectedAudio=${expectedAudio}`);
  }
  const output = await stat(filePath);
  return { durationSeconds, frames, codec: videoStream.codec_name, audioStreams: audioStreams.length, checksum: await checksumFile(filePath), bytes: output.size };
}

function publicJob(job: RendererRenderJob): RendererRenderJob {
  const safeJob = { ...job };
  delete safeJob.artifactPath;
  return safeJob;
}

async function runAsyncRenderJob(job: RendererRenderJob, project: RuntimeProjectV3): Promise<void> {
  const controller = new AbortController();
  activeRenderControllers.set(job.jobId, controller);
  const finalPath = join(outputRoot, job.outputName);
  const temporaryPath = join(outputRoot, `${job.jobId}.attempt-${job.attempt ?? 1}.tmp.mp4`);
  let progressTail = Promise.resolve();
  const updateProgress = (patch: Parameters<typeof renderJobStore.update>[1]) => {
    progressTail = progressTail.then(() => renderJobStore.update(job.jobId, patch).then(() => undefined));
  };
  try {
    await renderJobStore.update(job.jobId, { status: "planning", progress: 0.02, stage: "planning" });
    await mkdir(dirname(finalPath), { recursive: true });
    await renderJobStore.update(job.jobId, { status: "rendering", progress: 0.05, stage: "rendering" });
    const stats: ExportRenderStats = await renderRuntimeProjectV3(project, {
      outputPath: temporaryPath,
      signal: controller.signal,
      onProgress: (event) => {
        const ratio = event.totalFrames > 0 ? event.completedFrames / event.totalFrames : 0;
        updateProgress({ status: event.stage, stage: event.stage, progress: event.stage === "rendering" ? 0.05 + ratio * 0.78 : 0.86 });
      },
    });
    await progressTail;
    if (controller.signal.aborted) throw new Error("Render was cancelled.");
    await renderJobStore.update(job.jobId, { status: "muxing", progress: 0.9, stage: "muxing" });
    const expectedAudio = project.audioTimeline.tracks.some((track) => track.clips.length > 0);
    const verified = await verifyMp4(temporaryPath, stats.frames, stats.fps, expectedAudio);
    await renderJobStore.update(job.jobId, {
      status: "publishing",
      progress: 0.97,
      stage: "publishing",
      checksum: verified.checksum,
      stats: {
        frames: verified.frames,
        durationSeconds: verified.durationSeconds,
        outputBytes: verified.bytes,
        renderMilliseconds: stats.renderMilliseconds,
        encodeMilliseconds: stats.encodeMilliseconds,
        backendIdentity: stats.backendIdentity,
        scheduler: stats.scheduler,
        encodeBreakdown: stats.encodeBreakdown,
        renderBreakdown: stats.renderBreakdown,
        verifiedFrames: verified.frames,
        verifiedDurationSeconds: verified.durationSeconds,
        verifiedCodec: verified.codec,
        audioStreams: verified.audioStreams,
      },
    });
    await rename(temporaryPath, finalPath);
    await renderJobStore.update(job.jobId, { status: "done", progress: 1, stage: "done", artifactPath: finalPath, artifactUrl: outputUrl(job.outputName) });
  } catch (error) {
    const cancelled = controller.signal.aborted || (error instanceof Error && error.message === "Render was cancelled.");
    await renderJobStore.update(job.jobId, {
      status: cancelled ? "cancelled" : "failed",
      progress: cancelled ? 0 : 1,
      stage: cancelled ? "cancelled" : "failed",
      error: cancelled ? "Render was cancelled." : error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeRenderControllers.delete(job.jobId);
    await unlink(temporaryPath).catch(() => undefined);
  }
}

export function createExportRendererServer(options: {
  mediaPrepare?: (input: MediaPrepareRequest) => Promise<unknown>;
} = {}) {
  const mediaPrepare = options.mediaPrepare ?? prepareMediaJob;
  return createServer({ requestTimeout: 0, headersTimeout: 0 }, async (request, response) => {
    try {
      if (request.method === "GET" && ["/health", "/healthz", "/readyz"].includes(request.url ?? "")) {
        json(response, 200, { ok: true, service: "export-renderer", renderer: "skia-native-raster" });
        return;
      }
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (request.method === "POST" && requestUrl.pathname === "/v1/media/prepare") {
        const expectedToken = process.env.INTERNAL_WORKER_TOKEN?.trim();
        const rawToken = request.headers["x-internal-worker-token"];
        const suppliedToken = (Array.isArray(rawToken) ? rawToken[0] : rawToken)?.trim();
        if (!expectedToken) {
          json(response, 503, { ok: false, error: "worker_auth_not_configured" });
          return;
        }
        if (!suppliedToken || suppliedToken !== expectedToken) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        const body = await readJson(request) as Partial<MediaPrepareRequest>;
        if (!body.jobId || !body.assetId || !body.sourceKey || !body.sourceMimeType || !body.sourceIntegrity || !body.callbackUrl) {
          json(response, 400, { ok: false, error: "invalid_media_prepare_request" });
          return;
        }
        let callbackUrl: URL;
        try {
          callbackUrl = new URL(body.callbackUrl);
          if (!["http:", "https:"].includes(callbackUrl.protocol)) throw new Error("unsupported callback protocol");
        } catch {
          json(response, 400, { ok: false, error: "invalid_callback_url" });
          return;
        }
        const job = {
          jobId: body.jobId,
          assetId: body.assetId,
          sourceKey: body.sourceKey,
          sourceMimeType: body.sourceMimeType,
          ...(body.mediaKind ? { mediaKind: body.mediaKind } : {}),
          ...(body.derivativePrefix ? { derivativePrefix: body.derivativePrefix } : {}),
          sourceIntegrity: body.sourceIntegrity,
          callbackUrl: callbackUrl.toString(),
          ...(body.pipelineVersion ? { pipelineVersion: body.pipelineVersion } : {}),
        } satisfies MediaPrepareRequest;
        void mediaPrepare(job).catch((error) => {
          // The worker reports normal media failures through the callback. This
          // log only covers a callback or infrastructure failure after dispatch.
          console.error("[export-renderer] media job failed", { jobId: job.jobId, error });
        });
        json(response, 202, { ok: true, jobId: job.jobId, status: "processing" });
        return;
      }
      if (request.method === "POST" && requestUrl.pathname === "/v1/render-job-executions") {
        if (!authorizeConfiguredWorker(request)) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        const body = await readJson(request) as { jobId?: string; mode?: "sequential" | "chunk" | "finalizer"; taskCount?: number };
        if (!body.jobId || !/^[a-zA-Z0-9._-]+$/.test(body.jobId)) {
          json(response, 400, { ok: false, error: "job_id_required" });
          return;
        }
        if (body.mode && !["sequential", "chunk", "finalizer"].includes(body.mode)) {
          json(response, 400, { ok: false, error: "invalid_render_mode" });
          return;
        }
        const execution = await submitCloudRunRenderJob(body.jobId, { mode: body.mode, taskCount: body.taskCount });
        json(response, 202, { ok: true, jobId: body.jobId, execution });
        return;
      }
      if (requestUrl.pathname === "/v1/render-jobs" && request.method === "POST") {
        if (isControlPlaneOnly()) {
          json(response, 410, { ok: false, error: "legacy_render_route_disabled" });
          return;
        }
        if (!authorizeWorker(request)) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        const body = await readJson(request) as { jobId?: string; project?: RuntimeProjectV3; outputName?: string; attempt?: number };
        if (!body.jobId || !body.project) {
          json(response, 400, { ok: false, error: "job_id_and_project_required" });
          return;
        }
        let output: { name: string; path: string };
        try { output = localOutputPath(body.outputName, body.project.projectId); }
        catch (error) { json(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }); return; }
        await cleanupExpiredTemporaryArtifacts(outputRoot, Date.now() - temporaryArtifactTtlMs);
        const created = await renderJobStore.create({ jobId: body.jobId, outputName: output.name, attempt: body.attempt });
        if (created.created) void runAsyncRenderJob(created.job, body.project);
        json(response, created.created ? 202 : 200, {
          ok: true,
          created: created.created,
          jobId: created.job.jobId,
          status: created.job.status,
          statusUrl: `/v1/render-jobs/${encodeURIComponent(created.job.jobId)}`,
        });
        return;
      }
      if (requestUrl.pathname.startsWith("/v1/render-jobs/")) {
        if (isControlPlaneOnly()) {
          json(response, 410, { ok: false, error: "legacy_render_route_disabled" });
          return;
        }
        if (!authorizeWorker(request)) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        const jobId = decodeURIComponent(requestUrl.pathname.slice("/v1/render-jobs/".length));
        const job = await renderJobStore.get(jobId);
        if (!job) { json(response, 404, { ok: false, error: "render_job_not_found" }); return; }
        if (request.method === "DELETE") {
          if (!["done", "failed", "cancelled"].includes(job.status)) {
            activeRenderControllers.get(jobId)?.abort();
            await renderJobStore.update(jobId, { status: "cancelled", progress: 0, stage: "cancelled", error: "Render was cancelled." });
          }
          json(response, 200, { ok: true, job: publicJob((await renderJobStore.get(jobId)) ?? job) });
          return;
        }
        if (request.method === "GET") {
          json(response, 200, { ok: true, job: publicJob(job) });
          return;
        }
      }
      if (request.method === "GET" && requestUrl.pathname.startsWith("/v1/outputs/")) {
        if (isControlPlaneOnly()) {
          json(response, 410, { ok: false, error: "legacy_output_route_disabled" });
          return;
        }
        const token = requestUrl.pathname.slice("/v1/outputs/".length);
        const outputName = outputNameFromToken(token);
        const outputPath = join(outputRoot, outputName);
        const output = await stat(outputPath).catch(() => null);
        if (!output?.isFile()) {
          json(response, 404, { error: "output_not_found" });
          return;
        }
        response.statusCode = 200;
        response.setHeader("content-type", "video/mp4");
        response.setHeader("content-length", String(output.size));
        createReadStream(outputPath).pipe(response);
        return;
      }
      if (request.method !== "POST" || request.url !== "/v1/renders") {
        json(response, 404, { error: "not_found" });
        return;
      }
      if (isControlPlaneOnly()) {
        json(response, 410, { ok: false, error: "legacy_render_route_disabled" });
        return;
      }
      const body = await readJson(request) as {
        project?: RuntimeProjectV3;
        outputName?: string;
        frameCount?: number;
        parallelism?: number;
        chunkSize?: number;
        chunkRetries?: number;
        ffmpegPreset?: string;
        ffmpegCrf?: number;
      };
      if (!body.project) {
        json(response, 400, { error: "project_required" });
        return;
      }
      const output = localOutputPath(body.outputName, body.project.projectId);
      const stats = await renderRuntimeProjectV3(body.project, {
        outputPath: output.path,
        ...(body.frameCount ? { frameCount: body.frameCount } : {}),
        ...(body.parallelism ? { parallelism: body.parallelism } : {}),
        ...(body.chunkSize ? { chunkSize: body.chunkSize } : {}),
        ...(body.chunkRetries !== undefined ? { chunkRetries: body.chunkRetries } : {}),
        ...(body.ffmpegPreset ? { ffmpegPreset: body.ffmpegPreset } : {}),
        ...(body.ffmpegCrf !== undefined ? { ffmpegCrf: body.ffmpegCrf } : {}),
      });
      json(response, 200, { ok: true, stats, outputName: output.name, downloadUrl: `/v1/outputs/${outputToken(output.name)}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(response, 500, { ok: false, error: message });
    }
  });
}

if (process.argv[1]?.endsWith("server.ts")) {
  await mkdir(outputRoot, { recursive: true });
  createExportRendererServer().listen(port, "0.0.0.0", () => {
    console.log(`export-renderer listening on http://0.0.0.0:${port}`);
    console.log(`local output root: ${outputRoot}`);
  });
}
