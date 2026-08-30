import { describe, expect, it } from "vitest";
import { prepareMediaJob, type MediaObjectStore } from "./media-worker";

function fakeStore(source: Buffer) {
  const objects = new Map<string, Buffer>([["video/origin.mp4", source]]);
  const store: MediaObjectStore = {
    async getObject(key) { return objects.get(key) ?? null; },
    async putObject(input) { objects.set(input.key, input.body); },
  };
  return { store, objects };
}

describe("media worker", () => {
  it("downloads origin, creates canonical poster/audio keys, and reports ready", async () => {
    const { store, objects } = fakeStore(Buffer.from("origin-video"));
    const callbacks: unknown[] = [];
    const result = await prepareMediaJob({
      jobId: "job-1",
      assetId: "asset-1",
      sourceKey: "video/origin.mp4",
      sourceMimeType: "video/mp4",
      sourceIntegrity: "r2:12:asset-1/origin.mp4",
      callbackUrl: "https://web.example.test/api/internal/media-jobs/callback",
    }, {
      store,
      probe: async () => ({
        assetId: "asset-1",
        status: "processing",
        streams: [
          { streamId: "video", kind: "video", width: 1920, height: 1080, durationUs: 2_000_000 },
          { streamId: "audio", kind: "audio", sampleRate: 48000, channels: 2, durationSamples: 96000 },
        ],
        derivatives: [],
        updatedAt: new Date().toISOString(),
        version: 0,
      }),
      runFfmpeg: async (args) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(String(args.at(-1)), Buffer.from(String(args.at(-1))))); },
      callback: async (_url, payload) => { callbacks.push(payload); },
    });

    expect(result.status).toBe("ready");
    expect(result.derivatives.map((item) => item.uri)).toEqual(["asset-1/poster.webp", "asset-1/audio.m4a"]);
    expect(objects.has("asset-1/poster.webp")).toBe(true);
    expect(objects.has("asset-1/audio.m4a")).toBe(true);
    expect(callbacks).toHaveLength(1);
  });

  it("returns ready with only a poster when the video has no audio stream", async () => {
    const { store } = fakeStore(Buffer.from("origin-video"));
    const result = await prepareMediaJob({
      jobId: "job-2",
      assetId: "asset-2",
      sourceKey: "video/origin.mp4",
      sourceMimeType: "video/mp4",
      sourceIntegrity: "r2:12:asset-2/origin.mp4",
      callbackUrl: "https://web.example.test/api/internal/media-jobs/callback",
    }, {
      store,
      probe: async () => ({ assetId: "asset-2", status: "processing", streams: [{ streamId: "video", kind: "video", width: 1, height: 1 }], derivatives: [], updatedAt: "", version: 0 }),
      runFfmpeg: async (args) => { await import("node:fs/promises").then(({ writeFile }) => writeFile(String(args.at(-1)), Buffer.from("poster"))); },
      callback: async () => undefined,
    });
    expect(result.status).toBe("ready");
    expect(result.derivatives).toHaveLength(1);
    expect(result.derivatives[0]?.kind).toBe("poster");
  });

  it("reports failed when the origin cannot be probed", async () => {
    const { store } = fakeStore(Buffer.from("origin-video"));
    let callbackStatus = "";
    const result = await prepareMediaJob({
      jobId: "job-3",
      assetId: "asset-3",
      sourceKey: "video/origin.mp4",
      sourceMimeType: "video/mp4",
      sourceIntegrity: "r2:12:asset-3/origin.mp4",
      callbackUrl: "https://web.example.test/api/internal/media-jobs/callback",
    }, {
      store,
      probe: async () => { throw new Error("ffprobe failed"); },
      runFfmpeg: async () => undefined,
      callback: async (_url, payload) => { callbackStatus = payload.status; },
    });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("ffprobe failed");
    expect(callbackStatus).toBe("failed");
  });
});
