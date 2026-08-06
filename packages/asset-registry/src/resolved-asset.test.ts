import { describe, expect, it } from "vitest";
import {
  createAssetManifest,
  isFontMime,
  resolvedAssetFromManifestEntry,
} from "./index";

describe("ResolvedAsset", () => {
  it("maps manifest entries", () => {
    const manifest = createAssetManifest([
      {
        id: "f1",
        url: "/fonts/Lora.ttf",
        sha256: "abc",
        mimeType: "font/ttf",
      },
    ]);
    const resolved = resolvedAssetFromManifestEntry(manifest.entries[0]!, {
      fontFamily: "Lora",
    });
    expect(resolved.uri).toBe("/fonts/Lora.ttf");
    expect(resolved.fontFamily).toBe("Lora");
    expect(isFontMime(resolved.mimeType)).toBe(true);
  });
});
