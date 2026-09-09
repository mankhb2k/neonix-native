/** Server-only client for the native export-renderer VPS worker. */

import "server-only";

import { buildExportCanaryRecord } from "@/lib/server/render/export-canary";
import { buildRenderOutputKey, getRenderJob, updateRenderJob, type PersistentRenderJob } from "@/lib/server/render/job-store";
import { getUserExportsProvider } from "@/lib/server/r2";
import { PAINT_COMMAND_VERSION, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { COMPILER_SUPPORTED_FEATURES_VERSION } from "@motionvideo/motion-compiler";

type WorkerResponse = {
  ok: boolean;
  stats?: {
    frames: number;
    outputBytes: number;
    renderMilliseconds: number;
    encodeMilliseconds: number;
  };
  outputName?: string;
  downloadUrl?: string;
  error?: string;
};

function workerBaseUrl(): string {
  const value = process.env.EXPORT_RENDERER_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("EXPORT_RENDERER_URL is not configured");
  return value;
}

async function persistWorkerArtifact(outputUrl: string, outputKey: string): Promise<void> {
  const response = await fetch(outputUrl, {
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!response.ok) throw new Error(`worker artifact download failed with HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  await getUserExportsProvider().putObject({
    key: outputKey,
    body,
    contentType: "video/mp4",
  });
}

export async function startRenderOnWorker(input: {
  job: PersistentRenderJob;
  runtime: RuntimeProjectV3;
}): Promise<{ renderId: string; outputUrl: string }> {
  const baseUrl = workerBaseUrl();
  const outputKey = buildRenderOutputKey(input.job.userId, input.job.jobId);
  await updateRenderJob(input.job.jobId, {
    status: "rendering",
    progress: 0.05,
    stage: "vps-renderer",
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
    response = await fetch(`${baseUrl}/v1/renders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project: input.runtime, outputName: outputKey }),
    });
  } catch (error) {
    await updateRenderJob(input.job.jobId, { status: "failed", stage: "failed", error: `worker_unreachable: ${error instanceof Error ? error.message : String(error)}` });
    throw error;
  }

  const payload = await response.json() as WorkerResponse;
  if (!response.ok || !payload.ok || !payload.stats || !payload.downloadUrl) {
    const detail = payload.error ?? `worker returned HTTP ${response.status}`;
    await updateRenderJob(input.job.jobId, { status: "failed", stage: "failed", error: `worker_render_failed: ${detail}` });
    throw new Error(detail);
  }

  const outputUrl = new URL(payload.downloadUrl, baseUrl).toString();
  try {
    await persistWorkerArtifact(outputUrl, outputKey);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await updateRenderJob(input.job.jobId, { status: "failed", stage: "artifact-persist", error: `artifact_persist_failed: ${detail}` });
    throw error;
  }
  await updateRenderJob(input.job.jobId, {
    status: "done",
    progress: 1,
    stage: "done",
    artifactPath: `r2://${outputKey}`,
    metrics: {
      framesRendered: payload.stats.frames,
      outputSizeInBytes: payload.stats.outputBytes,
      timeToRenderFrames: payload.stats.renderMilliseconds,
      timeToEncode: payload.stats.encodeMilliseconds,
      timeToFinish: payload.stats.renderMilliseconds + payload.stats.encodeMilliseconds,
    },
  });
  return { renderId: input.job.jobId, outputUrl };
}

/** The initial VPS endpoint is synchronous; status is already persisted on return. */
export async function syncRenderJob(input: PersistentRenderJob): Promise<PersistentRenderJob> {
  return (await getRenderJob(input.jobId)) ?? input;
}

export async function cancelRenderOnWorker(job: PersistentRenderJob): Promise<void> {
  await updateRenderJob(job.jobId, {
    status: "cancelled",
    progress: 0,
    stage: "cancelled",
  });
}
