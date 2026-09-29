import { Injectable } from "@nestjs/common";

// Same contract as apps/web/lib/server/render/queue-worker-client.ts's
// `runCloudRunQueuedRender` (the non-chunked path): POST just {jobId} to the
// Cloud Run Service, which triggers a Cloud Run Job execution. The Job task
// itself (render-job.ts) reads render_jobs by RENDER_JOB_ID from whatever
// DATABASE_URL it's deployed with - the state machine lives entirely there,
// not in this dispatch call.
//
// NOTE: as of this port, the deployed Cloud Run Job still reads from
// Supabase, not Neon (see project memory) - calling this against a
// Neon-only render_jobs row will dispatch a real (billed) Cloud Run
// execution that fails to find the job. Do not call this from an automated
// test; see render-worker's own test, which mocks this service instead.
@Injectable()
export class CloudRunService {
  async submitRenderExecution(jobId: string): Promise<void> {
    const baseUrl = process.env.EXPORT_RENDERER_URL?.trim().replace(/\/$/, "");
    if (!baseUrl) throw new Error("EXPORT_RENDERER_URL is not configured");
    const token = process.env.INTERNAL_WORKER_TOKEN?.trim();

    const response = await fetch(`${baseUrl}/v1/render-job-executions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { "x-internal-worker-token": token } : {}) },
      body: JSON.stringify({ jobId }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `Cloud Run Job submit returned HTTP ${response.status}`);
    }
  }
}
