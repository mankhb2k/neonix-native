import { describe, expect, it } from "vitest";
import { textGlyphCacheKey } from "./text-atlas";

const glyph = {
  glyphId: 42,
  cluster: 0,
  clusterEnd: 1,
  x: 10,
  y: 20,
  width: 24,
  height: 30,
  path: "M0 0Z",
  pathScale: 1,
  outline: { x: 0, y: 0, width: 100, height: 100 },
  fontAssetId: "font-a",
  fontIntegrity: "sha256:a",
  variationKey: "wght=400",
  renderMode: "grayscale-mask" as const,
};

describe("text glyph cache key", () => {
  it("is stable for the same raster inputs", () => {
    expect(textGlyphCacheKey(glyph, { pixelsPerUnit: 16, transform: [1, 0, 0, 1] }))
      .toBe(textGlyphCacheKey({ ...glyph }, { pixelsPerUnit: 16, transform: [1, 0, 0, 1] }));
  });

  it("changes when font, scale, transform or render mode changes", () => {
    const base = textGlyphCacheKey(glyph, { pixelsPerUnit: 16, transform: [1, 0, 0, 1] });
    expect(textGlyphCacheKey({ ...glyph, fontIntegrity: "sha256:b" }, { pixelsPerUnit: 16, transform: [1, 0, 0, 1] })).not.toBe(base);
    expect(textGlyphCacheKey(glyph, { pixelsPerUnit: 8, transform: [1, 0, 0, 1] })).not.toBe(base);
    expect(textGlyphCacheKey(glyph, { pixelsPerUnit: 16, transform: [2, 0, 0, 2] })).not.toBe(base);
    expect(textGlyphCacheKey({ ...glyph, renderMode: "vector" }, { pixelsPerUnit: 16, transform: [1, 0, 0, 1] })).not.toBe(base);
  });
});
