import "server-only";

export const MEDIA_PIPELINE_VERSION = 1;

export type MediaJobDispatchInput = {
  jobId: string;
  assetId: string;
  sourceKey: string;
  sourceMimeType: string;
  sourceIntegrity: string;
};

function workerBaseUrl(): string {
  const value = process.env.EXPORT_RENDERER_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("EXPORT_RENDERER_URL is not configured");
  return value;
}

function workerToken(): string {
  const value = process.env.INTERNAL_WORKER_TOKEN?.trim();
  if (!value) throw new Error("INTERNAL_WORKER_TOKEN is not configured");
  return value;
}

function callbackUrl(): string {
  const explicit = process.env.MEDIA_CALLBACK_URL?.trim();
  const base = explicit || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!base) throw new Error("MEDIA_CALLBACK_URL or NEXT_PUBLIC_APP_URL is required");
  return new URL("/api/internal/media-jobs/callback", base).toString();
}

export async function dispatchMediaJob(input: MediaJobDispatchInput): Promise<void> {
  const response = await fetch(`${workerBaseUrl()}/v1/media/prepare`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-worker-token": workerToken(),
    },
    body: JSON.stringify({
      ...input,
      callbackUrl: callbackUrl(),
      pipelineVersion: MEDIA_PIPELINE_VERSION,
    }),
  });
  if (!response.ok) {
    let detail = `worker returned HTTP ${response.status}`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      // Keep the HTTP status when the worker did not return JSON.
    }
    throw new Error(detail);
  }
}
