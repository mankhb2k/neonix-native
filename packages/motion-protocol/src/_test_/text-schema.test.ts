import { describe, expect, it } from "vitest";
import { V2TextLayoutSchema, V2TextLayerSchema } from "../v2/layers/text";

const LAYOUT = {
  lines: [
    { id: "line-1", baselineY: 40, runIds: ["latin", "arabic-fallback"] },
  ],
  runs: [
    {
      id: "latin",
      font: { assetId: "inter", size: 32, variations: { wght: 650, opsz: 32 } },
      fill: "#ffffffff",
      glyphs: [
        { glyphId: 42, x: 0, y: 40, advance: { x: 18.5, y: 0 }, cluster: 0 },
      ],
    },
    {
      id: "arabic-fallback",
      font: { assetId: "noto-arabic", size: 32 },
      fill: "#00e5ffff",
      glyphs: [
        { glyphId: 70, x: 18.5, y: 40, advance: { x: 16, y: 0 }, cluster: 1 },
      ],
    },
  ],
};

describe("Protocol V2 shaped text layout", () => {
  it("accepts visual runs, positioned glyphs, fallback fonts, and variation coordinates", () => {
    expect(V2TextLayoutSchema.parse(LAYOUT)).toEqual(LAYOUT);
  });

  it("rejects unresolved, repeated, and unowned glyph-run references", () => {
    expect(() => V2TextLayoutSchema.parse({
      ...LAYOUT,
      lines: [{ ...LAYOUT.lines[0], runIds: ["missing"] }],
    })).toThrow(/Unknown glyph run/);
    expect(() => V2TextLayoutSchema.parse({
      ...LAYOUT,
      lines: [
        LAYOUT.lines[0],
        { id: "line-2", baselineY: 80, runIds: ["latin"] },
      ],
    })).toThrow(/exactly one text line/);
    expect(() => V2TextLayoutSchema.parse({
      ...LAYOUT,
      lines: [{ id: "line-1", baselineY: 40, runIds: ["latin"] }],
    })).toThrow(/not referenced/);
  });

  it("rejects old CSS-layout fields and keeps source text as non-rendering metadata", () => {
    const layer = {
      id: "title",
      parentLayerId: null,
      order: 0,
      frame: { width: 200, height: 80 },
      transform: {
        translate: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
        skew: { x: 0, y: 0 },
        anchor: { x: 0, y: 0, z: 0 },
      },
      opacity: 1,
      timing: { start: 0, duration: 1000 },
      type: "text" as const,
      payload: { source: { text: "A", language: "en" }, layout: LAYOUT },
    };
    expect(V2TextLayerSchema.parse(layer)).toEqual(layer);
    expect(() => V2TextLayerSchema.parse({
      ...layer,
      payload: { ...layer.payload, wrap: "normal" },
    })).toThrow();
    expect(() => V2TextLayerSchema.parse({
      ...layer,
      style: { fill: "#ffffff" },
    })).toThrow();
  });
});
