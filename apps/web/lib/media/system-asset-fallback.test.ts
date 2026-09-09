import { describe, expect, it } from "vitest";
import {
  SYSTEM_ASSET_FALLBACK_IDS,
  systemAssetFallbackId,
  systemAssetFallbackUrl,
} from "./system-asset-fallback";

describe("system media fallback", () => {
  it("keeps image fallbacks compatible with the source kind", () => {
    expect(systemAssetFallbackId("image", "image/png")).toBe(SYSTEM_ASSET_FALLBACK_IDS.image);
    expect(systemAssetFallbackId("image", "image/svg+xml")).toBe(SYSTEM_ASSET_FALLBACK_IDS.svg);
    expect(systemAssetFallbackUrl("image", "image/png")).toBe("/api/system-assets/system%3Aimage-placeholder");
  });

  it("uses a video fallback without changing the original asset identity", () => {
    expect(systemAssetFallbackId("video", "video/mp4")).toBe(SYSTEM_ASSET_FALLBACK_IDS.video);
    expect(systemAssetFallbackUrl("video", "video/mp4")).toBe("/api/system-assets/system%3Avideo-placeholder");
  });
});
