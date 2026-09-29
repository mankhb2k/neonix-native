import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { CloudRunService } from "../cloud-run/cloud-run.service";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";
import { renderJobs } from "../db/schema/render";

export type RenderJobPayload = {
  jobId: string;
};

const POLL_INTERVAL_MS = Number(process.env.RENDER_QUEUE_STATUS_POLL_MS ?? 2000);
const POLL_TIMEOUT_MS = Number(process.env.RENDER_QUEUE_STATUS_TIMEOUT_MS ?? 30 * 60_000);

// Replaces the pgmq-backed render_queue_* functions: BullMQ is a dispatch
// signal only, not the state machine. The real state (status/lease_owner/
// heartbeat_at) lives on the render_jobs row and is claimed/updated by the
// Cloud Run Job task itself (see render-native's render-job.ts) - this
// worker's job is exactly what apps/web's `runCloudRunQueuedRender` did:
// trigger the Cloud Run execution, then poll the row until it reaches a
// terminal status. Runs in the same process as the HTTP server (see
// project memory: no request-lifetime constraint forces a split here the
// way it did for the Vercel-hosted apps/web).
@Processor("render-jobs")
export class RenderWorkerProcessor extends WorkerHost {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly cloudRun: CloudRunService,
  ) {
    super();
  }

  async process(job: Job<RenderJobPayload>): Promise<void> {
    const { jobId } = job.data;
    await this.cloudRun.submitRenderExecution(jobId);

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const row = await this.db.query.renderJobs.findFirst({ where: eq(renderJobs.publicRef, jobId) });
      if (!row) throw new Error(`Render job disappeared while Cloud Run was running: ${jobId}`);
      if (row.status === "done" || row.status === "cancelled") return;
      if (row.status === "failed") throw new Error(row.errorCode ?? `Cloud Run render job failed: ${jobId}`);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error(`Cloud Run render job timed out after ${POLL_TIMEOUT_MS}ms: ${jobId}`);
  }
}
