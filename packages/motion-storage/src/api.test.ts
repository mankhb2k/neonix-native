import { describe, expect, it } from "vitest";
import request from "supertest";
import { createAssetApiApp } from "./server/create-app";
import { MemoryStorageProvider } from "./server/providers/memory";
import { createAssetStorageClient } from "./client";
import { createMapAssetUrlResolver, resolveAssetUri } from "./resolve";

describe("motion-storage closed loop", () => {
  it("ingests bytes and returns managed AssetV1", async () => {
    const provider = new MemoryStorageProvider({
      publicBaseUrl: "http://127.0.0.1:8787",
    });
    const { app } = createAssetApiApp({
      provider,
      publicBaseUrl: "http://127.0.0.1:8787",
    });

    const create = await request(app)
      .post("/assets/uploads")
      .send({
        assetType: "image",
        mimeType: "image/png",
        name: "logo.png",
        width: 64,
        height: 64,
      })
      .expect(201);

    expect(create.body.assetId).toMatch(/^asset\.image\./);
    expect(create.body.uploadUrl).toContain("/assets/uploads/");

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    await request(app)
      .put(`/assets/uploads/${create.body.assetId}/bytes`)
      .set("content-type", "image/png")
      .send(png)
      .expect(204);

    const complete = await request(app)
      .post(`/assets/uploads/${create.body.assetId}/complete`)
      .expect(200);

    expect(complete.body.asset.storage.managed).toBe(true);
    expect(complete.body.asset.uri).toBeUndefined();
    expect(complete.body.asset.integrity).toMatch(/^sha256:/);
    expect(complete.body.asset.sizeBytes).toBe(png.byteLength);

    const download = await request(app)
      .get(`/assets/${create.body.assetId}/download-url`)
      .expect(200);

    expect(download.body.url).toContain("/assets/objects/");

    const object = await request(app).get(
      new URL(download.body.url).pathname,
    );
    expect(object.status).toBe(200);
    expect(Buffer.from(object.body)).toEqual(png);

    const validate = await request(app)
      .post("/assets/validate")
      .send({ assets: [complete.body.asset] })
      .expect(200);
    expect(validate.body.ok).toBe(true);
    expect(validate.body.issues).toEqual([]);

    await request(app).delete(`/assets/${create.body.assetId}`).expect(204);
    const afterDelete = await request(app)
      .post("/assets/validate")
      .send({ assets: [complete.body.asset] })
      .expect(200);
    expect(afterDelete.body.ok).toBe(false);
    expect(afterDelete.body.issues[0]).toMatchObject({
      layer: "storage",
      code: "deleted",
      assetId: create.body.assetId,
      path: `assets.${create.body.assetId}`,
    });
  });

  it("client ingestBytes helper works against the app", async () => {
    const provider = new MemoryStorageProvider();
    const { app, service } = createAssetApiApp({
      provider,
      publicBaseUrl: "http://127.0.0.1",
    });

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected TCP address");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    provider.setPublicBaseUrl(baseUrl);
    service.setPublicBaseUrl(baseUrl);

    try {
      const client = createAssetStorageClient({ baseUrl });
      const bytes = Buffer.from("fake-audio");
      const asset = await client.ingestBytes(
        {
          assetType: "audio",
          mimeType: "audio/mpeg",
          name: "bed.mp3",
          duration: 12,
        },
        bytes,
      );
      expect(asset.assetType).toBe("audio");
      expect(asset.storage?.managed).toBe(true);

      const { url } = await client.getDownloadUrl(asset.id);
      const resolver = createMapAssetUrlResolver({ [asset.id]: url });
      expect(resolveAssetUri(asset, resolver)).toBe(url);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
