import { describe, expect, it, vi } from "vitest";
import { isOriginMediaKey, normalizeR2Event } from "../src/event";
import { handleQueueBatch } from "../src/index";

describe("media event contract", () => {
  it("accepts a canonical origin object", () => {
    expect(isOriginMediaKey("media/ws-1/asset-1/origin.mp4")).toBe(true);
    expect(normalizeR2Event({
      account: "account",
      action: "PutObject",
      bucket: "assets",
      eventTime: "2026-09-14T00:00:00.000Z",
      object: { key: "media/ws-1/asset-1/origin.mp4", size: 10, eTag: '"etag"' },
    }, "message-1")).toMatchObject({
      bucket: "assets",
      object: { key: "media/ws-1/asset-1/origin.mp4", eTag: "etag" },
    });
  });

  it("filters derivatives so a preparer upload cannot enqueue itself", () => {
    expect(isOriginMediaKey("media/ws-1/asset-1/audio.m4a")).toBe(false);
    expect(isOriginMediaKey("media/ws-1/asset-1/poster/poster.webp")).toBe(false);
  });

  it("rejects malformed R2 messages", () => {
    expect(normalizeR2Event({ object: { key: "media/ws/a/origin.mp4", size: -1 } }, "message-1")).toBeNull();
  });

  it("ACKs successful delivery, retries HTTP failures, and ignores derivatives", async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const r2Event = {
      account: "account",
      action: "PutObject",
      bucket: "assets",
      eventTime: "2026-09-14T00:00:00.000Z",
      object: { key: "media/ws-1/asset-1/origin.mp4", size: 10 },
    };
    const derivativeEvent = { ...r2Event, object: { key: "media/ws-1/asset-1/audio.m4a", size: 10 } };
    const firstFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    await handleQueueBatch({
      messages: [
        { id: "origin", timestamp: new Date(), body: r2Event, attempts: 1, ack, retry },
        { id: "derivative", timestamp: new Date(), body: derivativeEvent, attempts: 1, ack, retry },
      ],
    }, { MEDIA_EVENT_HMAC_SECRET: "secret", MEDIA_EVENTS_ENDPOINT: "https://app.example.test/api/internal/media-events" }, firstFetch);
    expect(firstFetch).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(2);
    expect(retry).not.toHaveBeenCalled();

    const failedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 409 }));
    await handleQueueBatch({
      messages: [{ id: "retry", timestamp: new Date(), body: r2Event, attempts: 2, ack: vi.fn(), retry }],
    }, { MEDIA_EVENT_HMAC_SECRET: "secret", MEDIA_EVENTS_ENDPOINT: "https://app.example.test/api/internal/media-events" }, failedFetch);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
