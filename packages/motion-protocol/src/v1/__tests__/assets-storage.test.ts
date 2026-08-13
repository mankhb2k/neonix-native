import { describe, expect, it } from "vitest";
import { AssetV1Schema } from "../assets";

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
