/* eslint-disable no-console */
import os from "node:os";
import { loadEnvConfig } from "@next/env";
import {
  claimRenderJob,
  getRenderJob,
  getRenderJobRuntime,
  recoverStaleRenderJobs,
  releaseRenderJobLease,
} from "@/lib/server/render/job-store";
import {
  isCloudRunJobDispatchEnabled,
  runCloudRunQueuedRender,
  runQueuedRender,
} from "@/lib/server/render/queue-worker-client";
import {
  archiveRenderQueueMessage,
  deleteRenderQueueMessage,
  enqueueRenderJob,
  readRenderQueue,
  type RenderQueueMessage,
} from "@/lib/server/render/render-queue";

loadEnvConfig(process.cwd());

const pollMilliseconds = Number(process.env.RENDER_QUEUE_POLL_MS ?? 1_000);
// Must stay >= queue-worker-client.ts's RENDER_QUEUE_STATUS_TIMEOUT_MS
// (default 30min): processOne holds this message the whole time it waits for
// the render to finish. A shorter visibility timeout lets the message become
// visible again mid-wait, so the same job gets dispatched a second time
// while the first attempt is still in flight (observed as a duplicate Cloud
// Run execution and a render_jobs row stuck between "publishing" and "done").
const visibilityTimeoutSeconds = Number(process.env.RENDER_QUEUE_VISIBILITY_TIMEOUT_SECONDS ?? 1_800);
const maxAttempts = Number(process.env.RENDER_QUEUE_MAX_ATTEMPTS ?? 5);
const staleAfterSeconds = Number(process.env.RENDER_QUEUE_STALE_SECONDS ?? Math.max(visibilityTimeoutSeconds * 2, 1_800));
const recoveryIntervalMilliseconds = Number(process.env.RENDER_QUEUE_RECOVERY_INTERVAL_MS ?? 30_000);
const workerId = process.env.RENDER_QUEUE_WORKER_ID?.trim() || `render-queue-${os.hostname()}-${process.pid}`;
const exitAfterOne = process.env.RENDER_QUEUE_EXIT_AFTER_ONE?.trim().toLowerCase() === "true";
/** Caps concurrent Cloud Run Job executions this worker will have in flight at once (cost control, not a Cloud Run limitation). */
const maxConcurrency = Math.max(1, Number(process.env.RENDER_QUEUE_MAX_CONCURRENCY ?? 5));

let stopping = false;
process.once("SIGTERM", () => { stopping = true; });
process.once("SIGINT", () => { stopping = true; });

function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parseMessage(value: unknown): RenderQueueMessage {
  if (!value || typeof value !== "object") throw new Error("render queue message is not an object");
  const message = value as Partial<RenderQueueMessage>;
  if (message.schemaVersion !== 2 || !message.jobId) {
    throw new Error("render queue message has an unsupported schema");
  }
  return message as RenderQueueMessage;
}

async function processOne(messageId: number, rawMessage: unknown, readCount: number): Promise<void> {
  let message: RenderQueueMessage;
  try {
    message = parseMessage(rawMessage);
  } catch (error) {
    console.error("[render-queue] archiving malformed message", { messageId, error });
    await archiveRenderQueueMessage(messageId);
    return;
  }

  try {
    const cloudRunDispatch = isCloudRunJobDispatchEnabled();
    const job = await getRenderJob(message.jobId);
    const runtime = await getRenderJobRuntime(message.jobId);
    if (!job || !runtime) {
      await archiveRenderQueueMessage(messageId);
      console.error("[render-queue] archived job without database manifest", { messageId, jobId: message.jobId });
      return;
    }
    if (job.status === "cancelled" || job.cancelRequested) {
      await deleteRenderQueueMessage(messageId);
      return;
    }
    if (job.status === "failed") {
      await archiveRenderQueueMessage(messageId);
      console.error("[render-queue] archived message for terminal failed job", { messageId, jobId: message.jobId });
      return;
    }
    const claimed = cloudRunDispatch ? job : await claimRenderJob(message.jobId, workerId, staleAfterSeconds);
    if (!claimed || claimed.status === "cancelled" || claimed.cancelRequested) {
      await deleteRenderQueueMessage(messageId);
      return;
    }
    if (cloudRunDispatch) {
      console.log("[render-queue] dispatching", { messageId, jobId: message.jobId });
      await runCloudRunQueuedRender({ job: claimed, workerId });
    } else {
      await runQueuedRender({ job: claimed, runtime, workerId });
      await releaseRenderJobLease(message.jobId, workerId);
    }
    await deleteRenderQueueMessage(messageId);
    console.log("[render-queue] dispatched", { messageId, jobId: message.jobId, readCount });
  } catch (error) {
    console.error("[render-queue] dispatch failed", { messageId, jobId: message.jobId, readCount, error });
    const latest = await getRenderJob(message.jobId);
    if (latest?.status === "cancelled" || latest?.cancelRequested) {
      await releaseRenderJobLease(message.jobId, workerId, "cancelled");
      await deleteRenderQueueMessage(messageId);
      return;
    }
    if (latest?.status === "failed") {
      await releaseRenderJobLease(message.jobId, workerId, "failed");
      await archiveRenderQueueMessage(messageId);
      console.error("[render-queue] archived terminal render failure", { messageId, jobId: message.jobId });
      return;
    }
    if (readCount >= maxAttempts) {
      await releaseRenderJobLease(message.jobId, workerId, "failed");
      await archiveRenderQueueMessage(messageId);
      console.error("[render-queue] archived after max attempts", { messageId, jobId: message.jobId });
    } else {
      await releaseRenderJobLease(message.jobId, workerId, "queued");
    }
    // Leave the message in-flight. PGMQ will make it visible again after the
    // visibility timeout, allowing transient worker/network failures to retry.
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !isCloudRunJobDispatchEnabled()) {
    throw new Error("Production render queue worker requires RENDER_DISPATCH_MODE=cloud-run-job");
  }
  let lastRecoveryAt = 0;
  // Each entry owns one message end-to-end (dispatch, wait, delete/retry); up
  // to maxConcurrency run at once so independent jobs don't queue behind each
  // other, while still bounding how many Cloud Run executions (cost) this
  // worker can have in flight simultaneously.
  const inFlight = new Set<Promise<void>>();
  console.log("[render-queue] consumer started", { pollMilliseconds, visibilityTimeoutSeconds, maxAttempts, staleAfterSeconds, workerId, exitAfterOne, maxConcurrency });
  while (!stopping) {
    try {
      if (Date.now() - lastRecoveryAt >= recoveryIntervalMilliseconds) {
        const recovered = await recoverStaleRenderJobs(staleAfterSeconds);
        for (const jobId of recovered) await enqueueRenderJob({ jobId });
        if (recovered.length > 0) console.log("[render-queue] recovered stale jobs", { jobs: recovered });
        lastRecoveryAt = Date.now();
      }
      const availableSlots = maxConcurrency - inFlight.size;
      if (availableSlots <= 0) {
        await sleep(pollMilliseconds);
        continue;
      }
      const messages = await readRenderQueue({ visibilityTimeoutSeconds, batchSize: availableSlots });
      if (messages.length > 0) console.log("[render-queue] read batch", { count: messages.length, availableSlots, inFlightBefore: inFlight.size, jobIds: messages.map((m) => m.message.jobId) });
      for (const message of messages) {
        const task = processOne(message.msg_id, message.message, message.read_ct)
          .catch((error: unknown) => console.error("[render-queue] unhandled processOne error", { messageId: message.msg_id, error }))
          .finally(() => inFlight.delete(task));
        inFlight.add(task);
        if (exitAfterOne) stopping = true;
      }
      if (messages.length === 0) await sleep(pollMilliseconds);
    } catch (error) {
      console.error("[render-queue] poll failed", error);
      await sleep(Math.max(pollMilliseconds, 2_000));
    }
  }
  await Promise.allSettled(inFlight);
  console.log("[render-queue] consumer stopped");
}

void main().catch((error) => {
  console.error("[render-queue] fatal error", error);
  process.exitCode = 1;
});
