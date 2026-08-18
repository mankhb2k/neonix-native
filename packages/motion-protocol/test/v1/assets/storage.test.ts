import { describe, expect, it } from "vitest";
import { AssetV1Schema } from "../../../src/v1/assets";

describe("AssetV1 storage policy", () => {
  it("accepts unmanaged fixture with uri", () => {
    const asset = AssetV1Schema.parse({
      id: "logo",
      uri: "./assets/logo.png",
      assetType: "image",
      mimeType: "image/png",
      width: 100,
      height: 100,
    });
    expect(asset.uri).toBe("./assets/logo.png");
    expect(asset.storage).toBeUndefined();
  });

  it("accepts unmanaged external URL with required metadata", () => {
    const asset = AssetV1Schema.parse({
      id: "poster",
      uri: "https://cdn.example.com/poster.webp",
      assetType: "image",
      mimeType: "image/webp",
      width: 1920,
      height: 1080,
    });
    expect(asset.uri).toBe("https://cdn.example.com/poster.webp");
    expect(asset.storage).toBeUndefined();
  });

  it("rejects unmanaged external URL without image dimensions", () => {
    const result = AssetV1Schema.safeParse({
      id: "poster",
      uri: "https://cdn.example.com/poster.webp",
      assetType: "image",
      mimeType: "image/webp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unmanaged external URL without video metadata", () => {
    const result = AssetV1Schema.safeParse({
      id: "intro",
      uri: "https://cdn.example.com/intro.mp4",
      assetType: "video",
      mimeType: "video/mp4",
      width: 1920,
      height: 1080,
    });
    expect(result.success).toBe(false);
  });

  it("accepts managed asset without uri", () => {
    const asset = AssetV1Schema.parse({
      id: "logo",
      assetType: "image",
      mimeType: "image/png",
      width: 100,
      height: 100,
      integrity: "sha256:abc",
      sizeBytes: 2048,
      storage: {
        managed: true,
        provider: "r2",
        key: "tmp/logo.png",
        retention: "temporary",
      },
      source: { kind: "upload", originalName: "logo.png" },
    });
    expect(asset.uri).toBeUndefined();
    expect(asset.storage?.managed).toBe(true);
  });

  it("rejects source kinds other than upload", () => {
    const result = AssetV1Schema.safeParse({
      id: "logo",
      assetType: "image",
      mimeType: "image/png",
      width: 100,
      height: 100,
      integrity: "sha256:abc",
      sizeBytes: 2048,
      storage: {
        managed: true,
        provider: "r2",
        key: "tmp/logo.png",
        retention: "temporary",
      },
      source: { kind: "googleDrive", externalId: "file-1" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects managed asset with uri", () => {
    const result = AssetV1Schema.safeParse({
      id: "logo",
      uri: "https://cdn.example/logo.png",
      assetType: "image",
      mimeType: "image/png",
      width: 100,
      height: 100,
      integrity: "sha256:abc",
      sizeBytes: 2048,
      storage: {
        managed: true,
        provider: "r2",
        key: "tmp/logo.png",
        retention: "temporary",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects managed asset without integrity", () => {
    const result = AssetV1Schema.safeParse({
      id: "logo",
      assetType: "image",
      mimeType: "image/png",
      width: 100,
      height: 100,
      sizeBytes: 2048,
      storage: {
        managed: true,
        provider: "r2",
        key: "tmp/logo.png",
        retention: "temporary",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unmanaged asset without uri", () => {
    const result = AssetV1Schema.safeParse({
      id: "logo",
      assetType: "image",
      mimeType: "image/png",
      width: 100,
      height: 100,
    });
    expect(result.success).toBe(false);
  });
});
