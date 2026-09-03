import { once } from "node:events";
import { describe, expect, it, afterEach } from "vitest";
import { createExportRendererServer } from "../api/server";

const originalToken = process.env.INTERNAL_WORKER_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.INTERNAL_WORKER_TOKEN;
  else process.env.INTERNAL_WORKER_TOKEN = originalToken;
});

describe("export renderer HTTP media endpoint", () => {
  it("authenticates and accepts a media job without waiting for processing", async () => {
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    let receivedJobId = "";
    const server = createExportRendererServer({
      mediaPrepare: async (input) => { receivedJobId = input.jobId; },
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    try {
      const unauthorized = await fetch(`http://127.0.0.1:${address.port}/v1/media/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(unauthorized.status).toBe(401);

      const response = await fetch(`http://127.0.0.1:${address.port}/v1/media/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-worker-token": "test-token" },
        body: JSON.stringify({
          jobId: "job-1",
          assetId: "asset-1",
          sourceKey: "asset-1/origin.mp4",
          sourceMimeType: "video/mp4",
          sourceIntegrity: "r2:1:asset-1/origin.mp4",
          callbackUrl: "https://web.example.test/api/internal/media-jobs/callback",
        }),
      });
      expect(response.status).toBe(202);
      expect(await response.json()).toMatchObject({ ok: true, jobId: "job-1", status: "processing" });
      expect(receivedJobId).toBe("job-1");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
