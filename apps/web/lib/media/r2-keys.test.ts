import { describe, expect, it } from "vitest";
import { defaultObjectKey, derivativeObjectKey } from "@/lib/server/r2";

const assetId = "7c2c4a4e-9b5a-4a2a-8c65-0c2d48c5d3e1";

describe("R2 user asset keys", () => {
  it("namespaces every original by asset id", () => {
    expect(defaultObjectKey(assetId, "image/png")).toBe(`${assetId}/origin.png`);
    expect(defaultObjectKey(assetId, "image/svg+xml")).toBe(`${assetId}/origin.svg`);
    expect(defaultObjectKey(assetId, "audio/mpeg")).toBe(`${assetId}/origin.mp3`);
  });

  it("namespaces video originals and derivatives by asset id", () => {
    expect(defaultObjectKey(assetId, "video/mp4")).toBe(`${assetId}/origin.mp4`);
    expect(derivativeObjectKey(assetId, "poster", "poster.webp")).toBe(`${assetId}/poster.webp`);
    expect(derivativeObjectKey(assetId, "audio", "stream-1.m4a")).toBe(`${assetId}/audio.m4a`);
  });
});
