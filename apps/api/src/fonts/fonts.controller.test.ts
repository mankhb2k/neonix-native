import { randomUUID } from "node:crypto";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { DatabaseModule } from "../db/database.module";
import { assets } from "../db/schema/assets";
import { userFontFamilies } from "../db/schema/fonts";
import { projects } from "../db/schema/projects";
import { R2Service } from "../r2/r2.service";
import { AssetsModule } from "../assets/assets.module";
import { ProjectsModule } from "../projects/projects.module";
import { FontsModule } from "./fonts.module";

const seedWorkspaceId = process.env.SEED_WORKSPACE_ID!;
const createdFamilyIds: string[] = [];
const createdAssetIds: string[] = [];
const createdProjectIds: string[] = [];
const uploadedR2Keys: string[] = [];
let app: INestApplication;
let r2: R2Service;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseModule, FontsModule, AssetsModule, ProjectsModule],
  }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  r2 = moduleRef.get(R2Service);
});

afterAll(async () => {
  for (const key of uploadedR2Keys) await r2.deleteObject(key).catch(() => undefined);
  if (createdProjectIds.length > 0) await db.delete(projects).where(inArray(projects.id, createdProjectIds));
  if (createdFamilyIds.length > 0) await db.delete(userFontFamilies).where(inArray(userFontFamilies.id, createdFamilyIds));
  if (createdAssetIds.length > 0) await db.delete(assets).where(inArray(assets.id, createdAssetIds));
  await app.close();
});

async function uploadRealAsset(kind: "font" | "image", mimeType: string, contents: string) {
  const body = Buffer.from(contents, "utf8");
  const requestResponse = await request(app.getHttpServer())
    .post("/v1/assets/upload-requests")
    .send({ workspaceId: seedWorkspaceId, mimeType, byteSize: body.byteLength, kind });
  const { asset, uploadUrl, headers } = requestResponse.body;
  createdAssetIds.push(asset.id);
  uploadedR2Keys.push(asset.r2Key);
  await fetch(uploadUrl, { method: "PUT", headers, body });
  await request(app.getHttpServer()).post(`/v1/assets/${asset.id}/complete`);
  return asset.id as string;
}

describe("fonts routes (Nest, real Neon dev DB + real R2 asset)", () => {
  it("creates a font family, attaches a real font asset as a face, and lists it", async () => {
    const slug = `test-font-${randomUUID().slice(0, 8)}`;
    const familyResponse = await request(app.getHttpServer())
      .post("/v1/fonts/families")
      .send({ workspaceId: seedWorkspaceId, slug, familyName: "Test Font" });
    expect(familyResponse.status).toBe(201);
    const familyId = familyResponse.body.fontFamily.id;
    createdFamilyIds.push(familyId);

    const fontAssetId = await uploadRealAsset("font", "font/woff2", "not-a-real-font-binary-just-bytes");

    const faceResponse = await request(app.getHttpServer())
      .post(`/v1/fonts/families/${familyId}/faces`)
      .send({ assetId: fontAssetId, faceKey: "regular", weight: 400, format: "woff2" });
    expect(faceResponse.status).toBe(201);
    expect(faceResponse.body.fontFace.fontFamilyId).toBe(familyId);

    const listResponse = await request(app.getHttpServer()).get(`/v1/fonts/families/${familyId}/faces`);
    expect(listResponse.body.fontFaces).toHaveLength(1);
  });

  it("rejects creating a font family with a slug already used in the workspace", async () => {
    const slug = `test-font-dup-${randomUUID().slice(0, 8)}`;
    const first = await request(app.getHttpServer())
      .post("/v1/fonts/families")
      .send({ workspaceId: seedWorkspaceId, slug, familyName: "First" });
    expect(first.status).toBe(201);
    createdFamilyIds.push(first.body.fontFamily.id);

    const duplicate = await request(app.getHttpServer())
      .post("/v1/fonts/families")
      .send({ workspaceId: seedWorkspaceId, slug, familyName: "Second" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("font_family_conflict");
  });

  it("rejects attaching a non-font asset as a face (validate_user_font_asset)", async () => {
    const familyResponse = await request(app.getHttpServer())
      .post("/v1/fonts/families")
      .send({ workspaceId: seedWorkspaceId, slug: `test-font-reject-${randomUUID().slice(0, 8)}`, familyName: "Reject Test" });
    const familyId = familyResponse.body.fontFamily.id;
    createdFamilyIds.push(familyId);

    const imageAssetId = await uploadRealAsset("image", "image/png", "not-a-real-png");

    const faceResponse = await request(app.getHttpServer())
      .post(`/v1/fonts/families/${familyId}/faces`)
      .send({ assetId: imageAssetId, faceKey: "regular", weight: 400, format: "woff2" });
    expect(faceResponse.status).toBe(422);
    expect(faceResponse.body.error.code).toBe("invalid_font_asset");
  });

  it("links a font family to a project only when they share a workspace (validate_project_user_font_family)", async () => {
    const familyResponse = await request(app.getHttpServer())
      .post("/v1/fonts/families")
      .send({ workspaceId: seedWorkspaceId, slug: `test-font-link-${randomUUID().slice(0, 8)}`, familyName: "Link Test" });
    const familyId = familyResponse.body.fontFamily.id;
    createdFamilyIds.push(familyId);

    const projectResponse = await request(app.getHttpServer())
      .post("/v1/projects")
      .send({ workspaceId: seedWorkspaceId, title: "Font link test project" });
    const projectId = projectResponse.body.project.id;
    createdProjectIds.push(projectId);

    const linkResponse = await request(app.getHttpServer())
      .post("/v1/fonts/project-links")
      .send({ projectId, fontFamilyId: familyId, alias: "My Alias" });
    expect(linkResponse.status).toBe(201);

    const listResponse = await request(app.getHttpServer()).get(`/v1/fonts/project-links?projectId=${projectId}`);
    expect(listResponse.body.projectFontFamilies).toHaveLength(1);
    expect(listResponse.body.projectFontFamilies[0].alias).toBe("My Alias");

    const deleteResponse = await request(app.getHttpServer())
      .delete("/v1/fonts/project-links")
      .send({ projectId, fontFamilyId: familyId });
    expect(deleteResponse.status).toBe(204);
  });
});
