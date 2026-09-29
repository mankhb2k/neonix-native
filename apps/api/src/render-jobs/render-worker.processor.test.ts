import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { Queue } from "bullmq";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { CloudRunService } from "../cloud-run/cloud-run.service";
import { db } from "../db/client";
import { DatabaseModule } from "../db/database.module";
import { projectRevisions, projects } from "../db/schema/projects";
import { renderJobs } from "../db/schema/render";
import { env } from "../env";
import { RenderWorkerModule } from "./render-worker.module";

const seedWorkspaceId = process.env.SEED_WORKSPACE_ID!;
const seedUserId = process.env.SEED_USER_ID!;
const createdProjectIds: string[] = [];

// The real dispatch call is mocked - see cloud-run.service.ts's own
// warning: calling it for real would trigger a real, billed Cloud Run
// execution that's guaranteed to fail today (the deployed Cloud Run Job
// still reads render_jobs from Supabase, not Neon - see project memory).
// This verifies the queue wiring itself: a job pushed onto Redis really
// reaches the in-process worker, which really calls the mocked dispatch
// with the right id, and really resolves once the row reaches `done`.
const submitRenderExecution = vi.fn(async (jobId: string) => {
  await db.update(renderJobs).set({ status: "done" }).where(eq(renderJobs.publicRef, jobId));
});

describe("render worker (Nest, real Redis/BullMQ, mocked Cloud Run dispatch)", () => {
  it("dispatches a queued render job through the real queue and resolves once the row is terminal", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection: { url: env.redisUrl, maxRetriesPerRequest: null } }),
        DatabaseModule,
        RenderWorkerModule,
      ],
    })
      .overrideProvider(CloudRunService)
      .useValue({ submitRenderExecution })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    const queue = moduleRef.get<Queue>(getQueueToken("render-jobs"));

    const [project] = await db.insert(projects).values({ workspaceId: seedWorkspaceId, createdBy: seedUserId }).returning();
    createdProjectIds.push(project.id);
    const [revision] = await db
      .insert(projectRevisions)
      .values({ projectId: project.id, revisionNo: 1, documentJson: {}, contentHash: "test", createdBy: seedUserId })
      .returning();
    const [renderJob] = await db
      .insert(renderJobs)
      .values({
        workspaceId: seedWorkspaceId,
        projectId: project.id,
        revisionId: revision.id,
        createdBy: seedUserId,
        idempotencyKey: `worker-test-${Date.now()}`,
      })
      .returning();

    try {
      await queue.add("dispatch", { jobId: renderJob.publicRef });

      const deadline = Date.now() + 10_000;
      let finalStatus: string | undefined;
      while (Date.now() < deadline) {
        const current = await db.query.renderJobs.findFirst({ where: eq(renderJobs.id, renderJob.id) });
        finalStatus = current?.status;
        if (finalStatus === "done") break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      expect(finalStatus).toBe("done");
      expect(submitRenderExecution).toHaveBeenCalledWith(renderJob.publicRef);
    } finally {
      await queue.close();
      await app.close();
    }
  }, 20_000);

  afterAll(async () => {
    if (createdProjectIds.length > 0) await db.delete(projects).where(inArray(projects.id, createdProjectIds));
  });
});
