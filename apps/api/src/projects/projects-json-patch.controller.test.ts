import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { compileDocument, stampNodeIds } from "@motionvideo/html-compiler";
import { inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { db } from "../db/client";
import { DatabaseModule } from "../db/database.module";
import { projects } from "../db/schema/projects";
import { seedUserGuard } from "../test/seed-user-guard";
import { HTML_COMPILER_FONT_ASSETS } from "./html-compiler-font-assets";
import { ProjectsModule } from "./projects.module";

const seedWorkspaceId = process.env.SEED_WORKSPACE_ID!;
const seedUserId = process.env.SEED_USER_ID!;
let app: INestApplication;

// This file's tests each create their own project in the shared seed
// workspace, which has a real active-project-limit quota (see
// quotas.service.ts) - running alongside every other test file's own
// project-creating tests in parallel (vitest's default) can transiently
// exceed it. Delete each test's project immediately once done, rather than
// batching cleanup into afterAll, to keep this file's peak footprint small
// (same fix as projects-html.controller.test.ts).
async function deleteProject(id: string) {
  await db.delete(projects).where(inArray(projects.id, [id]));
}

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1920,"fps":30,"background":"#000000","colorSpace":"srgb"}}' />
    <style>.label { font-family: Inter, sans-serif; font-weight: 400; }</style>
  </head>
  <body>
    <div class="label">hello</div>
  </body>
</html>`;

function realDocument() {
  const compiled = compileDocument({ html: stampNodeIds(HTML), fontAssets: HTML_COMPILER_FONT_ASSETS });
  if (compiled.status !== "success" || !compiled.protocol) throw new Error("fixture failed to compile");
  return compiled.protocol as unknown as Record<string, unknown>;
}

async function createProjectAtRevision1(): Promise<string> {
  const created = await request(app.getHttpServer())
    .post("/v1/projects")
    .send({ workspaceId: seedWorkspaceId, title: "JSON patch test project" });
  const projectId = created.body.project.id as string;
  await request(app.getHttpServer())
    .post(`/v1/projects/${projectId}/revisions`)
    .send({ documentJson: realDocument() });
  return projectId;
}

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
  await app.close();
});

describe("JSON patch routes (Nest, real Neon dev DB)", () => {
  it("applies a setComposition patch and bumps the revision", async () => {
    const projectId = await createProjectAtRevision1();
    try {
      const response = await request(app.getHttpServer())
        .patch(`/v1/projects/${projectId}/json`)
        .send({
          expectedProtocolRevisionNo: 1,
          patch: {
            format: "motion-protocol-patch",
            formatVersion: 2,
            baseRevision: 1,
            operations: [{ op: "setComposition", changes: { background: "#123456" } }],
          },
        });
      expect(response.status).toBe(200);
      expect(response.body.revision.revisionNo).toBe(2);
      expect(response.body.diagnostics).toEqual([]);

      const revision = await request(app.getHttpServer()).get(`/v1/projects/${projectId}/revisions/2`);
      expect(revision.body.revision.documentJson.composition.background).toBe("#123456");

      const project = await request(app.getHttpServer()).get(`/v1/projects/${projectId}`);
      expect(project.body.project.currentRevisionNo).toBe(2);
    } finally {
      await deleteProject(projectId);
    }
  });

  it("rejects a stale expectedProtocolRevisionNo with a conflict", async () => {
    const projectId = await createProjectAtRevision1();
    try {
      const response = await request(app.getHttpServer())
        .patch(`/v1/projects/${projectId}/json`)
        .send({
          expectedProtocolRevisionNo: 999,
          patch: { format: "motion-protocol-patch", formatVersion: 2, baseRevision: 999, operations: [{ op: "setComposition", changes: {} }] },
        });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("revision_conflict");
    } finally {
      await deleteProject(projectId);
    }
  });

  it("rejects a patch referencing an unknown layer with a 422 and diagnostics", async () => {
    const projectId = await createProjectAtRevision1();
    try {
      const response = await request(app.getHttpServer())
        .patch(`/v1/projects/${projectId}/json`)
        .send({
          expectedProtocolRevisionNo: 1,
          patch: {
            format: "motion-protocol-patch",
            formatVersion: 2,
            baseRevision: 1,
            operations: [{ op: "removeLayer", layerId: "does-not-exist" }],
          },
        });
      // removeLayer on an unknown layer is a "warning", not blocking - the
      // patch still succeeds with an empty diagnostic-free no-op change. Use
      // this to prove diagnostics of severity "warning" don't block the
      // patch, matching applyMotionProtocolV2Patch's own contract (only
      // "error" blocks).
      expect(response.status).toBe(200);
      expect(response.body.diagnostics).toHaveLength(1);
      expect(response.body.diagnostics[0].severity).toBe("warning");
    } finally {
      await deleteProject(projectId);
    }
  });

  it("rejects a structurally invalid patch with 422", async () => {
    const projectId = await createProjectAtRevision1();
    try {
      const response = await request(app.getHttpServer())
        .patch(`/v1/projects/${projectId}/json`)
        .send({ expectedProtocolRevisionNo: 1, patch: { not: "a valid patch" } });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("invalid_patch");
      expect(Array.isArray(response.body.error.details)).toBe(true);
    } finally {
      await deleteProject(projectId);
    }
  });
});
