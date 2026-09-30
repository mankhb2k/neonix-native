import { randomUUID } from "node:crypto";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { inArray } from "drizzle-orm";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { DatabaseModule } from "../db/database.module";
import { playgroundRateLimits } from "../db/schema/misc";
import { DocumentsModule } from "./documents.module";

const VALID_HTML = `<!doctype html>
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

const bucketKeys: string[] = [];
let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule, DocumentsModule] }).compile();
  // Mirrors main.ts's own body-parser setup for these two routes (bigger
  // limit than Express/Nest's 100kb default) - bodyParser:false + manual
  // mounting, since a bare TestingModule app never runs bootstrap().
  app = moduleRef.createNestApplication({ bodyParser: false });
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.use(["/v1/documents/compile", "/v1/documents/validate"], express.json({ limit: "1.5mb" }));
  app.use(express.json());
  await app.init();
});

afterAll(async () => {
  if (bucketKeys.length > 0) {
    await db.delete(playgroundRateLimits).where(inArray(playgroundRateLimits.bucketKey, bucketKeys));
  }
  await app.close();
});

describe("documents routes (Nest, no auth required)", () => {
  it("compiles valid HTML into a Protocol V2 document", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/documents/compile")
      .set("x-forwarded-for", nextTestIp())
      .send({ html: VALID_HTML });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe("succeeded");
    expect(response.body.protocolVersion).toBe(2);
    expect(response.body.protocol.layers.length).toBeGreaterThan(0);
  });

  it("rejects HTML that fails to compile with diagnostics", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/documents/compile")
      .set("x-forwarded-for", nextTestIp())
      .send({ html: "<html><body>no meta tag</body></html>" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("COMPILATION_FAILED");
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });

  it("rejects an oversized document", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/documents/compile")
      .set("x-forwarded-for", nextTestIp())
      .send({ html: "x".repeat(1_000_001) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("enforces the per-IP rate limit (20 requests / 60s)", async () => {
    const ip = nextTestIp();
    for (let i = 0; i < 20; i += 1) {
      const response = await request(app.getHttpServer())
        .post("/v1/documents/compile")
        .set("x-forwarded-for", ip)
        .send({ html: VALID_HTML });
      expect(response.status).toBe(201);
    }
    const blocked = await request(app.getHttpServer())
      .post("/v1/documents/compile")
      .set("x-forwarded-for", ip)
      .send({ html: VALID_HTML });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });

  it("validates HTML without consuming the compile rate limit", async () => {
    const valid = await request(app.getHttpServer()).post("/v1/documents/validate").send({ html: VALID_HTML });
    expect(valid.status).toBe(201);
    expect(valid.body.valid).toBe(true);
    expect(valid.body.documentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(valid.body.stats.layerCount).toBeGreaterThan(0);

    const invalid = await request(app.getHttpServer())
      .post("/v1/documents/validate")
      .send({ html: "<html><body>no meta tag</body></html>" });
    expect(invalid.status).toBe(201);
    expect(invalid.body.valid).toBe(false);
  });

  it("serves static compiler capabilities with no auth", async () => {
    const response = await request(app.getHttpServer()).get("/v1/capabilities");
    expect(response.status).toBe(200);
    expect(response.body.protocolVersion).toBe(2);
    expect(response.body.document.kind).toBe("neonix-html-document");
    expect(Array.isArray(response.body.cssProperties)).toBe(true);
    expect(response.body.cssProperties.length).toBeGreaterThan(0);
  });
});

function nextTestIp(): string {
  const ip = `test-${randomUUID()}`;
  bucketKeys.push(`documents-compile:${ip}`);
  return ip;
}
