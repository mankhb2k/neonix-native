import { describe, expect, it } from "vitest";
import {
  assertAssetHash,
  createAssetManifest,
  normalizeSha256,
} from "./asset-manifest";
import { buildAssetManifestFromBytes, sha256Hex } from "./server";

describe("AssetManifest", () => {
  it("normalizes sha256 prefixes", () => {
    expect(normalizeSha256("sha256:AbC")).toBe("abc");
  });

  it("fails closed on hash mismatch", () => {
    const manifest = createAssetManifest([
      {
        id: "a1",
        url: "https://cdn.example/a.png",
        sha256: "aaa",
        mimeType: "image/png",
      },
    ]);
    expect(() => assertAssetHash(manifest, "a1", "bbb")).toThrow(/mismatch/);
    expect(() => assertAssetHash(manifest, "missing", "aaa")).toThrow(/missing/);
  });

  it("server hash builds matching entries", () => {
    const bytes = Buffer.from("hello-asset");
    const digest = sha256Hex(bytes);
    const manifest = buildAssetManifestFromBytes([
      {
        id: "font",
        url: "file://font.woff2",
        mimeType: "font/woff2",
        bytes,
      },
    ]);
    expect(assertAssetHash(manifest, "font", digest).mimeType).toBe("font/woff2");
  });
});
