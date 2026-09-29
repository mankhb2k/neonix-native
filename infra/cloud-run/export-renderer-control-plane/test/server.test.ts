import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { createControlPlaneServer } from "../src/server";

const originalToken = process.env.INTERNAL_WORKER_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.INTERNAL_WORKER_TOKEN;
  else process.env.INTERNAL_WORKER_TOKEN = originalToken;
});

async function withServer(
  options: Parameters<typeof createControlPlaneServer>[0],
  run: (base: string) => Promise<void>,
): Promise<void> {
  const server = createControlPlaneServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

describe("export-renderer control plane", () => {
  it("reports healthy", async () => {
    await withServer({}, async (base) => {
      const response = await fetch(`${base}/healthz`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true });
    });
  });

  it("rejects /v1/media/prepare without the worker token", async () => {
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    await withServer({}, async (base) => {
      const response = await fetch(`${base}/v1/media/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(401);
    });
  });

  it("authenticates and proxies a media job without waiting for processing", async () => {
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    let receivedJobId = "";
    await withServer(
      { mediaPrepare: async (input) => { receivedJobId = input.jobId; } },
      async (base) => {
        const response = await fetch(`${base}/v1/media/prepare`, {
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
      },
    );
  });

  it("rejects /v1/render-job-executions without the worker token", async () => {
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    await withServer({}, async (base) => {
      const response = await fetch(`${base}/v1/render-job-executions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: "rnd_example" }),
      });
      expect(response.status).toBe(401);
    });
  });

  it("rejects an invalid job id even with a valid token", async () => {
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    await withServer({}, async (base) => {
      const response = await fetch(`${base}/v1/render-job-executions`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-worker-token": "test-token" },
        body: JSON.stringify({ jobId: "not a valid job id" }),
      });
      expect(response.status).toBe(400);
    });
  });
});
