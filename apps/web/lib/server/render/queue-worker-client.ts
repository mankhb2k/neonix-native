import { getUserExportsProvider } from "@/lib/server/r2";
import { buildRenderOutputKey, getRenderJob, getRenderJobChunkSummary, recoverStaleRenderFinalizer, recoverStaleRenderJobChunks, type PersistentRenderJob, touchRenderJobLease, updateRenderJob } from "./job-store";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

type WorkerResponse = {
  ok?: boolean;
  jobId?: string;
  statusUrl?: string;
  status?: string;
  error?: string;
  job?: {
    status: string;
    progress: number;
    stage?: string;
    error?: string;
    artifactUrl?: string;
    stats?: {
      frames: number;
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
};

function workerBaseUrl(): string {
  const value = process.env.EXPORT_RENDERER_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("EXPORT_RENDERER_URL is not configured");
  return value;
}

export function isCloudRunJobDispatchEnabled(): boolean {
  return process.env.RENDER_DISPATCH_MODE?.trim().toLowerCase() === "cloud-run-job";
}

function isChunkedCloudRunDispatchEnabled(): boolean {
  return isCloudRunJobDispatchEnabled() && process.env.RENDER_CHUNK_EXECUTION_ENABLED?.trim().toLowerCase() === "true";
}

async function submitCloudRunExecution(baseUrl: string, token: string | undefined, body: Record<string, unknown>): Promise<{ name?: string; uid?: string }> {
  const response = await fetch(`${baseUrl}/v1/render-job-executions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-internal-worker-token": token } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? `Cloud Run Job submit returned HTTP ${response.status}`);
  return (payload as { execution?: { name?: string; uid?: string } }).execution ?? {};
}

async function runChunkedCloudRunQueuedRender(input: { job: PersistentRenderJob; workerId: string }): Promise<void> {
  const baseUrl = workerBaseUrl();
  const token = process.env.INTERNAL_WORKER_TOKEN?.trim();
  const summary = await getRenderJobChunkSummary(input.job.jobId);
  if (!summary || summary.chunkCount < 1) throw new Error("Render job has no chunk manifest.");
  await submitCloudRunExecution(baseUrl, token, { jobId: input.job.jobId, mode: "chunk", taskCount: summary.chunkCount });
  const pollMilliseconds = Math.max(250, Number(process.env.RENDER_QUEUE_STATUS_POLL_MS ?? 1_000));
  const timeoutMilliseconds = Number(process.env.RENDER_QUEUE_STATUS_TIMEOUT_MS ?? 30 * 60_000);
  const staleAfterSeconds = Math.max(60, Number(process.env.RENDER_JOB_CHUNK_STALE_AFTER_SECONDS ?? process.env.RENDER_JOB_STALE_AFTER_SECONDS ?? 1800));
  const recoveryIntervalMilliseconds = Math.max(5_000, Number(process.env.RENDER_CHUNK_RECOVERY_INTERVAL_MS ?? 30_000));
  const deadline = Date.now() + timeoutMilliseconds;
  let lastRecoveryAt = 0;
  while (Date.now() < deadline) {
    if (Date.now() - lastRecoveryAt >= recoveryIntervalMilliseconds) {
      const recovered = await recoverStaleRenderJobChunks(input.job.jobId, staleAfterSeconds);
      if (recovered > 0) {
        await submitCloudRunExecution(baseUrl, token, { jobId: input.job.jobId, mode: "chunk", taskCount: summary.chunkCount });
      }
      lastRecoveryAt = Date.now();
    }
    const current = await getRenderJobChunkSummary(input.job.jobId);
    if (!current) throw new Error("Render chunk state disappeared while Cloud Run was running.");
    if (current.failed > 0 || current.cancelled > 0) throw new Error(`Render chunk execution failed: verified=${current.verified}/${current.chunkCount}, failed=${current.failed}`);
    if (current.verified === current.chunkCount) break;
    await sleep(pollMilliseconds);
  }
  if (Date.now() >= deadline) throw new Error(`Render chunk execution timed out after ${timeoutMilliseconds}ms`);
  await submitCloudRunExecution(baseUrl, token, { jobId: input.job.jobId, mode: "finalizer" });
  let lastFinalizerRetryAttempt = Number(input.job.attemptCount ?? 0);
  const finalizerRecoveryIntervalMilliseconds = Math.max(5_000, Number(process.env.RENDER_FINALIZER_RECOVERY_INTERVAL_MS ?? 30_000));
  const finalizerMaxAttempts = Math.max(1, Number(process.env.RENDER_FINALIZER_MAX_ATTEMPTS ?? (Number(process.env.RENDER_FINALIZER_RETRIES ?? 1) + 1)));
  let lastFinalizerRecoveryAt = 0;
  while (Date.now() < deadline) {
    if (Date.now() - lastFinalizerRecoveryAt >= finalizerRecoveryIntervalMilliseconds) {
      const recovered = await recoverStaleRenderFinalizer(input.job.jobId, staleAfterSeconds, finalizerMaxAttempts);
      if (recovered.state === "failed") {
        throw new Error("Cloud Run finalizer stale-lease retry budget exhausted.");
      }
      if (recovered.state === "recovered") {
        await submitCloudRunExecution(baseUrl, token, { jobId: input.job.jobId, mode: "finalizer" });
        lastFinalizerRetryAttempt = recovered.attemptCount ?? lastFinalizerRetryAttempt + 1;
      }
      lastFinalizerRecoveryAt = Date.now();
    }
    const current = await getRenderJob(input.job.jobId);
    if (!current) throw new Error("Render job disappeared while finalizer was running.");
    if (current.status === "done" || current.status === "cancelled") return;
    if (current.status === "failed") throw new Error(current.error ?? "Cloud Run finalizer failed.");
    const currentFinalizerAttempt = Number(current.attemptCount ?? 0);
    if (current.status === "queued" && current.stage === "finalizer-retry"
      && currentFinalizerAttempt > lastFinalizerRetryAttempt) {
      await submitCloudRunExecution(baseUrl, token, { jobId: input.job.jobId, mode: "finalizer" });
      lastFinalizerRetryAttempt = currentFinalizerAttempt;
    }
    await sleep(pollMilliseconds);
  }
  throw new Error(`Cloud Run finalizer timed out after ${timeoutMilliseconds}ms`);
}

export async function runCloudRunQueuedRender(input: {
  job: PersistentRenderJob;
  workerId: string;
}): Promise<void> {
  if (isChunkedCloudRunDispatchEnabled()) {
    await runChunkedCloudRunQueuedRender(input);
    return;
  }
  const baseUrl = workerBaseUrl();
  const token = process.env.INTERNAL_WORKER_TOKEN?.trim();
  const response = await fetch(`${baseUrl}/v1/render-job-executions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-internal-worker-token": token } : {}) },
    body: JSON.stringify({ jobId: input.job.jobId }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? `Cloud Run Job submit returned HTTP ${response.status}`);

  const pollMilliseconds = Number(process.env.RENDER_QUEUE_STATUS_POLL_MS ?? 1_000);
  const timeoutMilliseconds = Number(process.env.RENDER_QUEUE_STATUS_TIMEOUT_MS ?? 30 * 60_000);
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const current = await getRenderJob(input.job.jobId);
    if (!current) throw new Error("Render job disappeared while Cloud Run Job was running.");
    if (current.status === "done" || current.status === "cancelled") return;
    if (current.status === "failed") throw new Error(current.error ?? "Cloud Run render job failed.");
    await sleep(pollMilliseconds);
  }
  throw new Error(`Cloud Run render job timed out after ${timeoutMilliseconds}ms`);
}

export async function dispatchQueuedRender(input: {
  job: PersistentRenderJob;
  runtime: RuntimeProjectV3;
}): Promise<{ renderId: string; statusUrl: string }> {
  const baseUrl = workerBaseUrl();
  const token = process.env.INTERNAL_WORKER_TOKEN?.trim();
  const response = await fetch(`${baseUrl}/v1/render-jobs`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { "x-internal-worker-token": token } : {}) },
    body: JSON.stringify({
      jobId: input.job.jobId,
      project: input.runtime,
      outputName: buildRenderOutputKey(input.job.userId, input.job.jobId),
      attempt: input.job.attemptCount ?? 1,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as WorkerResponse;
  if (!response.ok || !payload.ok || !payload.jobId || !payload.statusUrl) {
    throw new Error(payload.error ?? `worker returned HTTP ${response.status}`);
  }
  return {
    renderId: payload.jobId,
    statusUrl: new URL(payload.statusUrl, baseUrl).toString(),
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function workerStatus(value: string): PersistentRenderJob["status"] {
  const allowed: PersistentRenderJob["status"][] = ["queued", "planning", "rendering", "encoding", "muxing", "publishing", "done", "failed", "cancelled"];
  return allowed.includes(value as PersistentRenderJob["status"]) ? value as PersistentRenderJob["status"] : "failed";
}

async function persistWorkerArtifact(artifactUrl: string, outputKey: string): Promise<void> {
  const response = await fetch(artifactUrl, { signal: AbortSignal.timeout(10 * 60_000) });
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

export async function runQueuedRender(input: {
  job: PersistentRenderJob;
  runtime: RuntimeProjectV3;
  workerId: string;
}): Promise<void> {
  const current = await getRenderJob(input.job.jobId);
  if (!current || current.status === "cancelled" || current.cancelRequested) {
    throw new Error("Render was cancelled.");
  }
  const dispatched = await dispatchQueuedRender(input);
  const pollMilliseconds = Number(process.env.RENDER_QUEUE_STATUS_POLL_MS ?? 1_000);
  const timeoutMilliseconds = Number(process.env.RENDER_QUEUE_STATUS_TIMEOUT_MS ?? 30 * 60_000);
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    if (!(await touchRenderJobLease(input.job.jobId, input.workerId))) {
      throw new Error("Render lease was lost.");
    }
    const response = await fetch(dispatched.statusUrl, {
      headers: { ...(process.env.INTERNAL_WORKER_TOKEN?.trim() ? { "x-internal-worker-token": process.env.INTERNAL_WORKER_TOKEN.trim() } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`worker status returned HTTP ${response.status}`);
    const payload = await response.json() as WorkerResponse;
    const remote = payload.job;
    if (!remote) throw new Error("worker status response has no job");
    const status = workerStatus(remote.status);
    await updateRenderJob(input.job.jobId, {
      status,
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
    });

    if (status === "failed" || status === "cancelled") {
      if (remote.error) throw new Error(remote.error);
      return;
    }
    if (status === "done") {
      if (!remote.artifactUrl) throw new Error("worker completed without an artifact URL");
      const outputKey = buildRenderOutputKey(input.job.userId, input.job.jobId);
      await persistWorkerArtifact(new URL(remote.artifactUrl, dispatched.statusUrl).toString(), outputKey);
      await updateRenderJob(input.job.jobId, {
        status: "done",
        progress: 1,
        stage: "done",
        outputKey,
        artifactPath: `r2://${outputKey}`,
      });
      return;
    }
    await sleep(pollMilliseconds);
  }

  throw new Error(`render queue worker timed out after ${timeoutMilliseconds}ms`);
}
