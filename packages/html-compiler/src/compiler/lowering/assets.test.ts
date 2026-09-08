import { describe, expect, it } from "vitest";
import { createAssetRegistry } from "./assets";
import { parseHtml } from "../html/parser";

describe("asset registry", () => {
  it("preserves asset IDs and deduplicates repeated registrations", () => {
    const node = parseHtml(`<img id="poster" src="/poster.png">`).children[0]!;
    const registry = createAssetRegistry({ mediaAssets: [{ uri: "/poster.png", kind: "image", width: 640, height: 360 }] });

    expect(registry.registerImage(node, "/poster.png")).toBe("poster-asset");
    expect(registry.registerImage(node, "/poster.png")).toBe("poster-asset");
    expect(registry.assets).toHaveLength(1);
    expect(registry.assets[0]).toMatchObject({ id: "poster-asset", kind: "image", width: 640, height: 360 });
  });
});
