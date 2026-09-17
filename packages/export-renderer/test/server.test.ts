import { once } from "node:events";
import { existsSync } from "node:fs";
import { describe, expect, it, afterEach } from "vitest";
import { identityMatrix4 } from "@motionvideo/motion-runtime";
import { createExportRendererServer } from "../src/api/server";

const originalToken = process.env.INTERNAL_WORKER_TOKEN;
const originalControlPlaneOnly = process.env.EXPORT_RENDERER_CONTROL_PLANE_ONLY;
const nativeSkiaAvailable = Boolean(process.env.NATIVE_SKIA_BINARY && existsSync(process.env.NATIVE_SKIA_BINARY));

afterEach(() => {
  if (originalToken === undefined) delete process.env.INTERNAL_WORKER_TOKEN;
  else process.env.INTERNAL_WORKER_TOKEN = originalToken;
  if (originalControlPlaneOnly === undefined) delete process.env.EXPORT_RENDERER_CONTROL_PLANE_ONLY;
  else process.env.EXPORT_RENDERER_CONTROL_PLANE_ONLY = originalControlPlaneOnly;
});

describe("export renderer HTTP media endpoint", () => {
  it("disables legacy file-backed render routes in control-plane mode", async () => {
    process.env.EXPORT_RENDERER_CONTROL_PLANE_ONLY = "1";
    const server = createExportRendererServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/v1/render-jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: "legacy", project: {} }),
      });
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({ error: "legacy_render_route_disabled" });
    } finally {
      server.close();
      await once(server, "close");
    }
  });

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

  (nativeSkiaAvailable ? it : it.skip)("accepts an async native render job, exposes progress, and publishes a verified artifact", async () => {
    process.env.INTERNAL_WORKER_TOKEN = "test-token";
    const server = createExportRendererServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    const projectId = `phase4-test-${Date.now()}`;
    const project = {
      format: "motion-runtime" as const,
      runtimeVersion: 3 as const,
      projectId,
      durationUs: 33_334,
      visual: {
        composition: { width: 16, height: 16, fps: 30, duration: 1 / 30, background: "#000000", graphId: projectId },
        view: { worldToClipMatrix: identityMatrix4() },
        nodes: [],
      },
      mediaCatalog: { assets: [] },
      videoTimeline: { instances: [] },
      audioTimeline: { sampleRate: 48_000, tracks: [] },
    };
    try {
      const base = `http://127.0.0.1:${address.port}`;
      const created = await fetch(`${base}/v1/render-jobs`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-worker-token": "test-token" },
        body: JSON.stringify({ jobId: projectId, project, outputName: `${projectId}.mp4` }),
      });
      expect(created.status).toBe(202);
      expect((await created.json()) as { status: string }).toMatchObject({ status: "queued" });

      let terminal: { status: string; artifactUrl?: string; stats?: { frames: number } } | null = null;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
        const statusResponse = await fetch(`${base}/v1/render-jobs/${projectId}`, { headers: { "x-internal-worker-token": "test-token" } });
        const payload = await statusResponse.json() as { job: typeof terminal };
        terminal = payload.job;
        if (terminal && ["done", "failed", "cancelled"].includes(terminal.status)) break;
      }
      expect(terminal?.status).toBe("done");
      expect(terminal?.stats?.frames).toBe(1);
      expect(terminal?.artifactUrl).toBeTruthy();
      const artifact = await fetch(new URL(terminal?.artifactUrl ?? "", base), { headers: { "x-internal-worker-token": "test-token" } });
      expect(artifact.status).toBe(200);
      expect(Number(artifact.headers.get("content-length"))).toBeGreaterThan(0);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
