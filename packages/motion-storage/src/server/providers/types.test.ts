import { describe, expect, it } from "vitest";
import { defaultObjectKey, derivativeObjectKey } from "./types";

describe("asset object keys", () => {
  it("keeps originals and derivatives under one asset namespace", () => {
    expect(defaultObjectKey("9f3d", "video/mp4")).toBe(
      "assets/9f3d/original.mp4",
    );
    expect(derivativeObjectKey("9f3d", "audio", "stream-1.m4a")).toBe(
      "assets/9f3d/audio/stream-1.m4a",
    );
    expect(derivativeObjectKey("9f3d", "poster", "poster.webp")).toBe(
      "assets/9f3d/poster/poster.webp",
    );
  });

  it("treats asset-prefixed ids as aliases, not new storage identities", () => {
    expect(defaultObjectKey("asset-9f3d", "video/mp4")).toBe(
      defaultObjectKey("9f3d", "video/mp4"),
    );
    expect(derivativeObjectKey("asset-9f3d", "audio", "stream-1.m4a")).toBe(
      "assets/9f3d/audio/stream-1.m4a",
    );
  });
});
