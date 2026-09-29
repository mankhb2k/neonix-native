import { randomUUID } from "node:crypto";
import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Queue } from "bullmq";
import { eq, inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { db } from "../db/client";
import { DatabaseModule } from "../db/database.module";
import { env } from "../env";
import { projects } from "../db/schema/projects";
import { renderJobs } from "../db/schema/render";
import { ProjectsModule } from "../projects/projects.module";
import { seedUserGuard } from "../test/seed-user-guard";
import { RenderJobsModule } from "./render-jobs.module";

const seedWorkspaceId = process.env.SEED_WORKSPACE_ID!;
const seedUserId = process.env.SEED_USER_ID!;
const createdProjectIds: string[] = [];
let app: INestApplication;
let queue: Queue;

async function createProjectWithRevision() {
  const projectResponse = await request(app.getHttpServer())
    .post("/v1/projects")
    .send({ workspaceId: seedWorkspaceId, title: "Render job test project" });
  const projectId = projectResponse.body.project.id;
  createdProjectIds.push(projectId);
  await request(app.getHttpServer())
    .post(`/v1/projects/${projectId}/revisions`)
    .send({ documentJson: { hello: "world" } });
  return projectId;
}

beforeAll(async () => {
  // Deliberately NOT importing RenderWorkerModule - this test only checks
  // that a job is created and enqueued, not that it gets dispatched to
  // Cloud Run (see render-worker.processor.test.ts for that, mocked).
  const moduleRef = await Test.createTestingModule({
    imports: [
      BullModule.forRoot({ connection: { url: env.redisUrl, maxRetriesPerRequest: null } }),
      DatabaseModule,
      RenderJobsModule,
      ProjectsModule,
    ],
  })
    .overrideGuard(CurrentUserGuard)
    .useValue(seedUserGuard(seedUserId))
    .compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  queue = moduleRef.get(getQueueToken("render-jobs"));
});

afterAll(async () => {
  if (createdProjectIds.length > 0) await db.delete(projects).where(inArray(projects.id, createdProjectIds));
  await queue.close();
  await app.close();
});

describe("render-jobs routes (Nest, real Neon dev DB + real BullMQ enqueue)", () => {
  it("creates a render job against a project's latest revision and enqueues it", async () => {
    const projectId = await createProjectWithRevision();

    const response = await request(app.getHttpServer()).post("/v1/render-jobs").send({ projectId });
    expect(response.status).toBe(202);
    expect(response.body.renderJob.status).toBe("queued");
    expect(response.body.renderJob.publicRef).toMatch(/^rnd_/);

    const jobs = await queue.getJobs(["waiting", "active", "completed"]);
    expect(jobs.some((j) => j.data.jobId === response.body.renderJob.publicRef)).toBe(true);
  });

  it("rejects creating a render job for a project with no revisions yet", async () => {
    const projectResponse = await request(app.getHttpServer())
      .post("/v1/projects")
      .send({ workspaceId: seedWorkspaceId, title: "No revisions yet" });
    createdProjectIds.push(projectResponse.body.project.id);

    const response = await request(app.getHttpServer())
      .post("/v1/render-jobs")
      .send({ projectId: projectResponse.body.project.id });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("no_revision");
  });

  it("is idempotent: retrying with the same idempotencyKey returns the original job", async () => {
    const projectId = await createProjectWithRevision();
    const idempotencyKey = randomUUID();

    const first = await request(app.getHttpServer()).post("/v1/render-jobs").send({ projectId, idempotencyKey });
    expect(first.status).toBe(202);

    const retry = await request(app.getHttpServer()).post("/v1/render-jobs").send({ projectId, idempotencyKey });
    expect(retry.status).toBe(200);
    expect(retry.body.idempotent).toBe(true);
    expect(retry.body.renderJob.id).toBe(first.body.renderJob.id);
  });

  it("lists render jobs for a workspace and gets one by id", async () => {
    const projectId = await createProjectWithRevision();
    const created = await request(app.getHttpServer()).post("/v1/render-jobs").send({ projectId });

    const listResponse = await request(app.getHttpServer()).get(`/v1/render-jobs?workspaceId=${seedWorkspaceId}`);
    expect(listResponse.body.renderJobs.map((j: { id: string }) => j.id)).toContain(created.body.renderJob.id);

    const getResponse = await request(app.getHttpServer()).get(`/v1/render-jobs/${created.body.renderJob.id}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.renderJob.id).toBe(created.body.renderJob.id);
  });

  it("cancels a render job (owner-only, matching the original RLS)", async () => {
    const projectId = await createProjectWithRevision();
    const created = await request(app.getHttpServer()).post("/v1/render-jobs").send({ projectId });

    const cancelResponse = await request(app.getHttpServer()).post(`/v1/render-jobs/${created.body.renderJob.id}/cancel`);
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.renderJob.cancelRequested).toBe(true);

    await db.update(renderJobs).set({ status: "done" }).where(eq(renderJobs.id, created.body.renderJob.id));
    const cancelAgain = await request(app.getHttpServer()).post(`/v1/render-jobs/${created.body.renderJob.id}/cancel`);
    expect(cancelAgain.status).toBe(409);
  });
});
