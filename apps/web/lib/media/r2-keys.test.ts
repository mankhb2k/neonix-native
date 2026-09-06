import { describe, expect, it } from "vitest";
import { defaultObjectKey, derivativeObjectKey } from "@/lib/server/r2";

const assetId = "7c2c4a4e-9b5a-4a2a-8c65-0c2d48c5d3e1";
const workspaceId = "8e92be38-57a1-4518-9fd1-cde40de5b2d7";

describe("R2 user asset keys", () => {
  it("namespaces every original by asset id", () => {
    expect(defaultObjectKey(workspaceId, assetId, "image/png")).toBe(`media/${workspaceId}/${assetId}/origin.png`);
    expect(defaultObjectKey(workspaceId, assetId, "image/svg+xml")).toBe(`media/${workspaceId}/${assetId}/origin.svg`);
    expect(defaultObjectKey(workspaceId, assetId, "audio/mpeg")).toBe(`media/${workspaceId}/${assetId}/origin.mp3`);
  });

  it("namespaces video originals and derivatives by asset id", () => {
    expect(defaultObjectKey(workspaceId, assetId, "video/mp4")).toBe(`media/${workspaceId}/${assetId}/origin.mp4`);
    expect(derivativeObjectKey(workspaceId, assetId, "poster", "poster.webp")).toBe(`media/${workspaceId}/${assetId}/poster.webp`);
    expect(derivativeObjectKey(workspaceId, assetId, "audio", "stream-1.m4a")).toBe(`media/${workspaceId}/${assetId}/audio.m4a`);
  });
});
