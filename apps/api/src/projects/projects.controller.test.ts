import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { db } from "../db/client";
import { DatabaseModule } from "../db/database.module";
import { accountPlans } from "../db/schema/identity";
import { seedUserGuard } from "../test/seed-user-guard";
import { ProjectsModule } from "./projects.module";

const seedWorkspaceId = process.env.SEED_WORKSPACE_ID!;
const seedUserId = process.env.SEED_USER_ID!;
const createdProjectIds: string[] = [];
let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule, ProjectsModule] })
    .overrideGuard(CurrentUserGuard)
    .useValue(seedUserGuard(seedUserId))
    .compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
});

afterAll(async () => {
  for (const id of createdProjectIds) {
    await request(app.getHttpServer()).delete(`/v1/projects/${id}`);
  }
  await app.close();
});

describe("projects routes (Nest, real Neon dev DB)", () => {
  it("creates a project in the seed workspace", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/projects")
      .send({ workspaceId: seedWorkspaceId, title: "Phase 3 Nest test project" });
    expect(response.status).toBe(201);
    expect(response.body.project.title).toBe("Phase 3 Nest test project");
    expect(response.body.project.currentRevisionNo).toBe(0);
    createdProjectIds.push(response.body.project.id);
  });

  it("lists the created project", async () => {
    const response = await request(app.getHttpServer()).get(`/v1/projects?workspaceId=${seedWorkspaceId}`);
    expect(response.status).toBe(200);
    const ids = response.body.projects.map((p: { id: string }) => p.id);
    expect(ids).toContain(createdProjectIds[0]);
  });

  it("updates a project's title", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/projects/${createdProjectIds[0]}`)
      .send({ title: "Renamed project" });
    expect(response.status).toBe(200);
    expect(response.body.project.title).toBe("Renamed project");
  });

  it("creates a revision and bumps current_revision_no + last_activity_at", async () => {
    const before = await request(app.getHttpServer()).get(`/v1/projects/${createdProjectIds[0]}`);
    const beforeActivity = before.body.project.lastActivityAt;

    const response = await request(app.getHttpServer())
      .post(`/v1/projects/${createdProjectIds[0]}/revisions`)
      .send({ documentJson: { hello: "world" } });
    expect(response.status).toBe(201);
    expect(response.body.revision.revisionNo).toBe(1);

    const after = await request(app.getHttpServer()).get(`/v1/projects/${createdProjectIds[0]}`);
    expect(after.body.project.currentRevisionNo).toBe(1);
    expect(new Date(after.body.project.lastActivityAt).getTime())
      .toBeGreaterThanOrEqual(new Date(beforeActivity).getTime());
  });

  it("soft-deletes then restores a project", async () => {
    const deleted = await request(app.getHttpServer()).delete(`/v1/projects/${createdProjectIds[0]}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.project.deletedAt).not.toBeNull();

    const goneFromGet = await request(app.getHttpServer()).get(`/v1/projects/${createdProjectIds[0]}`);
    expect(goneFromGet.status).toBe(404);

    const restored = await request(app.getHttpServer()).post(`/v1/projects/${createdProjectIds[0]}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.project.deletedAt).toBeNull();

    const backFromGet = await request(app.getHttpServer()).get(`/v1/projects/${createdProjectIds[0]}`);
    expect(backFromGet.status).toBe(200);
  });

  describe("active project count limit", () => {
    beforeAll(async () => {
      await db.update(accountPlans).set({ maxActiveProjects: 1 }).where(eq(accountPlans.id, seedUserId));
    });

    afterAll(async () => {
      await db.update(accountPlans).set({ maxActiveProjects: 10 }).where(eq(accountPlans.id, seedUserId));
    });

    it("rejects creating a project once the plan's active-project limit is reached", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/projects")
        .send({ workspaceId: seedWorkspaceId, title: "Over the limit" });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("project_limit_reached");
    });
  });
});
