/** Server-only client for the native export-renderer worker. */

import "server-only";

import { getUserExportsProvider } from "@/lib/server/r2";
import { buildExportCanaryRecord } from "@/lib/server/render/export-canary";
import { buildRenderOutputKey, getRenderJob, updateRenderJob, type PersistentRenderJob } from "@/lib/server/render/job-store";
import { COMPILER_SUPPORTED_FEATURES_VERSION } from "@motionvideo/motion-compiler";
import { PAINT_COMMAND_VERSION, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";

type WorkerResponse = {
  ok: boolean;
  created?: boolean;
  jobId?: string;
  status?: string;
  statusUrl?: string;
  job?: {
    jobId: string;
    status: string;
    progress: number;
    stage?: string;
    error?: string;
    artifactUrl?: string;
    stats?: {
      frames: number;
      durationSeconds: number;
      outputBytes: number;
      renderMilliseconds: number;
      encodeMilliseconds: number;
      audioStreams?: number;
      verifiedFrames?: number;
      verifiedDurationSeconds?: number;
      verifiedCodec?: string;
      encodeBreakdown?: {
        framesSubmitted: number;
        pipeWriteMilliseconds: number;
        backpressureWaitMilliseconds: number;
        finalizeMilliseconds: number;
      };
      renderBreakdown?: {
        audioPreparationMilliseconds?: number;
      };
    };
  };
  error?: string;
};

function workerBaseUrl(): string {
  const value = process.env.EXPORT_RENDERER_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("EXPORT_RENDERER_URL is not configured");
  return value;
}

function workerHeaders(): Record<string, string> {
  const token = process.env.INTERNAL_WORKER_TOKEN?.trim();
  return { "content-type": "application/json", ...(token ? { "x-internal-worker-token": token } : {}) };
}

async function persistWorkerArtifact(outputUrl: string, outputKey: string): Promise<void> {
  const response = await fetch(outputUrl, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`worker artifact download failed with HTTP ${response.status}`);
  const provider = getUserExportsProvider();
  const temporaryKey = `__tmp__/render/${outputKey}.attempt-${Date.now().toString(36)}`;
  try {
    const contentLength = Number(response.headers.get("content-length"));
    await provider.putObjectFromWebStream({
      key: temporaryKey,
      body: response.body,
      contentType: "video/mp4",
      ...(Number.isSafeInteger(contentLength) && contentLength >= 0 ? { contentLength } : {}),
    });
    if (Number.isSafeInteger(contentLength) && contentLength >= 0) {
      const uploaded = await provider.headObject(temporaryKey);
      if (!uploaded || uploaded.sizeBytes !== contentLength) {
        throw new Error(`R2 artifact size mismatch: expected ${contentLength}, got ${uploaded?.sizeBytes ?? "missing"}`);
      }
    }
    await provider.copyObject(temporaryKey, outputKey);
  } finally {
    await provider.deleteObject(temporaryKey).catch(() => undefined);
  }
}

export async function startRenderOnWorker(input: {
  job: PersistentRenderJob;
  runtime: RuntimeProjectV3;
}): Promise<{ renderId: string; outputUrl: string }> {
  const baseUrl = workerBaseUrl();
  const outputKey = buildRenderOutputKey(input.job, input.job.jobId);
  await updateRenderJob(input.job.jobId, {
    status: "queued",
    progress: 0.01,
    stage: "dispatching",
    outputKey,
    canaryJson: JSON.stringify(buildExportCanaryRecord({
      engine: "native-vps",
      paintCommandVersion: PAINT_COMMAND_VERSION,
      capabilityManifest: COMPILER_SUPPORTED_FEATURES_VERSION,
      preflightOk: true,
    })),
  });

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/render-jobs`, {
      method: "POST",
      headers: workerHeaders(),
      body: JSON.stringify({ jobId: input.job.jobId, project: input.runtime, outputName: outputKey, attempt: input.job.attemptCount ?? 1 }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    await updateRenderJob(input.job.jobId, { status: "failed", stage: "failed", error: `worker_unreachable: ${error instanceof Error ? error.message : String(error)}` });
    throw error;
  }
  const payload = await response.json() as WorkerResponse;
  if (!response.ok || !payload.ok || !payload.jobId || !payload.statusUrl) {
    const detail = payload.error ?? `worker returned HTTP ${response.status}`;
    await updateRenderJob(input.job.jobId, { status: "failed", stage: "failed", error: `worker_dispatch_failed: ${detail}` });
    throw new Error(detail);
  }
  const allowedStatuses: PersistentRenderJob["status"][] = ["queued", "planning", "rendering", "encoding", "muxing", "publishing", "done", "failed", "cancelled"];
  const status = payload.status && allowedStatuses.includes(payload.status as PersistentRenderJob["status"])
    ? payload.status as PersistentRenderJob["status"]
    : "queued";
  await updateRenderJob(input.job.jobId, { status, progress: status === "done" ? 1 : 0.01, stage: status });
  return { renderId: input.job.jobId, outputUrl: new URL(payload.statusUrl, baseUrl).toString() };
}

/** Poll the asynchronous worker and persist its state locally. */
export async function syncRenderJob(input: PersistentRenderJob): Promise<PersistentRenderJob> {
  if (["done", "failed", "cancelled"].includes(input.status)) return input;
  const baseUrl = workerBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/render-jobs/${encodeURIComponent(input.jobId)}`, {
      headers: workerHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return (await getRenderJob(input.jobId)) ?? input;
  }
  if (!response.ok) return (await getRenderJob(input.jobId)) ?? input;
  const payload = await response.json() as WorkerResponse;
  const remote = payload.job;
  if (!remote) return (await getRenderJob(input.jobId)) ?? input;
  const local = (await updateRenderJob(input.jobId, {
    status: remote.status as PersistentRenderJob["status"],
    progress: remote.progress,
    stage: remote.stage,
    ...(remote.error ? { error: remote.error } : {}),
    ...(remote.stats ? {
      metrics: {
        framesRendered: remote.stats.frames,
        outputSizeInBytes: remote.stats.outputBytes,
        timeToRenderFrames: remote.stats.renderMilliseconds,
        timeToEncode: remote.stats.encodeMilliseconds,
        timeToFinish: remote.stats.renderMilliseconds + remote.stats.encodeMilliseconds,
        ...(remote.stats.audioStreams !== undefined ? { audioStreams: remote.stats.audioStreams } : {}),
        ...(remote.stats.verifiedFrames !== undefined ? { verifiedFrames: remote.stats.verifiedFrames } : {}),
        ...(remote.stats.verifiedDurationSeconds !== undefined ? { verifiedDurationSeconds: remote.stats.verifiedDurationSeconds } : {}),
        ...(remote.stats.verifiedCodec ? { verifiedCodec: remote.stats.verifiedCodec } : {}),
        ...(remote.stats.encodeBreakdown ? { encodeBreakdown: remote.stats.encodeBreakdown } : {}),
        ...(remote.stats.renderBreakdown?.audioPreparationMilliseconds !== undefined
          ? { audioPreparationMilliseconds: remote.stats.renderBreakdown.audioPreparationMilliseconds }
          : {}),
      },
    } : {}),
  })) ?? input;
  if (remote.status !== "done" || !remote.artifactUrl || local.artifactPath) return local;
  try {
    const outputKey = local.outputKey ?? buildRenderOutputKey(local, local.jobId);
    await persistWorkerArtifact(new URL(remote.artifactUrl, baseUrl).toString(), outputKey);
    return (await updateRenderJob(local.jobId, { status: "done", progress: 1, stage: "done", artifactPath: `r2://${outputKey}`, outputKey })) ?? local;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return (await updateRenderJob(local.jobId, { status: "failed", stage: "artifact-persist", error: `artifact_persist_failed: ${detail}` })) ?? local;
  }
}

export async function cancelRenderOnWorker(job: PersistentRenderJob): Promise<void> {
  await updateRenderJob(job.jobId, {
    status: "cancelled",
    progress: 0,
    stage: "cancelled",
    error: "Render was cancelled.",
    cancelRequested: true,
    heartbeatAt: undefined,
    leaseOwner: undefined,
  });
  if (job.status === "queued" || job.stage === "dispatching") return;
  const baseUrl = workerBaseUrl();
  const response = await fetch(`${baseUrl}/v1/render-jobs/${encodeURIComponent(job.jobId)}`, {
    method: "DELETE",
    headers: workerHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) throw new Error(`worker cancellation failed with HTTP ${response.status}`);
}
