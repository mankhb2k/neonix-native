import { describe, expect, it } from "vitest";
import {
  createFfprobeMediaProbeV3,
  hydrateRuntimeMediaCatalogV3,
  MemoryMediaProbeStoreV3,
  runMediaDerivativeJobsV3,
  runMediaProbeJobV3,
} from "../index";

describe("media probe V3", () => {
  it("deduplicates probe jobs and persists lifecycle output", async () => {
    const store = new MemoryMediaProbeStoreV3();
    const first = await store.enqueue({ jobId: "job-1", assetId: "video", idempotencyKey: "video:sha256:a", status: "queued", createdAt: "2026-08-28T00:00:00Z" });
    const second = await store.enqueue({ jobId: "job-2", assetId: "video", idempotencyKey: "video:sha256:a", status: "queued", createdAt: "2026-08-28T00:00:01Z" });
    expect(second).toEqual(first);
    const record = await runMediaProbeJobV3(store, first, async () => ({ assetId: "video", status: "ready", sourceIntegrity: "sha256:a", streams: [{ streamId: "video:video", kind: "video", durationUs: 4_000_000, width: 1920, height: 1080, frameRate: 30 }, { streamId: "video:audio", kind: "audio", durationSamples: 192_000, sampleRate: 48000, channels: 2 }], derivatives: [{ derivativeId: "video:audio:v1", kind: "audio", uri: "/derivatives/video.m4a", mimeType: "audio/mp4", version: 1 }], updatedAt: "", version: 0 }));
    expect(record.version).toBe(1);
    expect(record.status).toBe("ready");
  });

  it("hydrates audio from the derivative, not the original video URI", () => {
    const snapshot = hydrateRuntimeMediaCatalogV3({ assetId: "video", status: "ready", streams: [{ streamId: "video:audio", kind: "audio", durationSamples: 10, sampleRate: 48000, channels: 2 }], derivatives: [{ derivativeId: "d", kind: "audio", uri: "/audio.m4a", mimeType: "audio/mp4", version: 1 }], updatedAt: "", version: 1 }, "/video.mp4", "video/mp4");
    expect(snapshot.catalog.assets[0]?.audio?.[0]?.resource.uri).toBe("/audio.m4a");
    expect(snapshot.catalog.assets[0]?.audio?.[0]?.resource.role).toBe("audio-proxy");
  });

  it("does not fall back to the original video as an audio resource", () => {
    const snapshot = hydrateRuntimeMediaCatalogV3({ assetId: "video", status: "partial", streams: [{ streamId: "video:audio", kind: "audio", durationSamples: 10, sampleRate: 48000, channels: 2 }], derivatives: [], updatedAt: "", version: 1 }, "/video.mp4", "video/mp4");
    expect(snapshot.catalog.assets[0]?.audio).toBeUndefined();
    expect(snapshot.diagnostics).toEqual([{ code: "missing_audio_derivative", assetId: "video", streamId: "video:audio" }]);
  });

  it("persists a failed lifecycle state when probing throws", async () => {
    const store = new MemoryMediaProbeStoreV3();
    const result = await runMediaProbeJobV3(store, { jobId: "j", assetId: "bad", idempotencyKey: "bad", status: "queued", createdAt: "" }, async () => { throw new Error("ffprobe unavailable"); });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("ffprobe unavailable");
    expect((await store.get("bad"))?.status).toBe("failed");
  });

  it("normalizes ffprobe streams into sample-accurate metadata", async () => {
    const probe = createFfprobeMediaProbeV3({ run: async () => JSON.stringify({ streams: [{ codec_type: "audio", codec_name: "aac", duration: "2.5", sample_rate: "44100", channels: 2, time_base: "1/44100" }, { codec_type: "video", codec_name: "h264", duration: "2.5", width: 1280, height: 720, r_frame_rate: "30/1" }] }) });
    const result = await probe("source.mp4", "asset");
    expect(result.streams[0]).toMatchObject({ kind: "audio", sampleRate: 44100, durationSamples: 110250 });
    expect(result.streams[1]).toMatchObject({ kind: "video", width: 1280, frameRate: 30 });
  });

  it("marks derivatives partial when poster generation fails but audio is verified", async () => {
    const store = new MemoryMediaProbeStoreV3();
    const record = { assetId: "a", status: "processing" as const, streams: [], derivatives: [], version: 0, updatedAt: "" };
    const result = await runMediaDerivativeJobsV3(store, record, "/source.mp4", { generateAudioDerivative: async () => ({ derivativeId: "audio-v1", kind: "audio", uri: "/audio.m4a", mimeType: "audio/mp4", version: 1 }), generatePoster: async () => { throw new Error("poster failed"); } }, async (derivative) => ({ ok: derivative.kind === "audio" }));
    expect(result.status).toBe("partial");
    expect(result.derivatives).toHaveLength(1);
  });
});
