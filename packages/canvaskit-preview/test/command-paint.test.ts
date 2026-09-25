import { describe, expect, it } from "vitest";
import { blendModeFor } from "../src/command/paint";
import type { SkiaCanvasKit } from "../src/canvas-kit";

function makeKit() {
  // Every CSS mix-blend-mode keyword's Skia equivalent, keyed by the exact
  // PascalCase name blendModeFor derives from the CSS keyword.
  return {
    BlendMode: {
      SrcOver: "SrcOver",
      Darken: "Darken",
      Multiply: "Multiply",
      ColorBurn: "ColorBurn",
      Lighten: "Lighten",
      Screen: "Screen",
      ColorDodge: "ColorDodge",
      Overlay: "Overlay",
      SoftLight: "SoftLight",
      HardLight: "HardLight",
      Difference: "Difference",
      Exclusion: "Exclusion",
      Hue: "Hue",
      Saturation: "Saturation",
      Color: "Color",
      Luminosity: "Luminosity",
    },
  } as unknown as SkiaCanvasKit;
}

describe("Skia mix-blend-mode mapping", () => {
  it.each([
    ["normal", "SrcOver"],
    ["darken", "Darken"],
    ["multiply", "Multiply"],
    ["color-burn", "ColorBurn"],
    ["lighten", "Lighten"],
    ["screen", "Screen"],
    ["color-dodge", "ColorDodge"],
    ["overlay", "Overlay"],
    ["soft-light", "SoftLight"],
    ["hard-light", "HardLight"],
    ["difference", "Difference"],
    ["exclusion", "Exclusion"],
    ["hue", "Hue"],
    ["saturation", "Saturation"],
    ["color", "Color"],
    ["luminosity", "Luminosity"],
  ])("maps CSS mix-blend-mode: %s to kit.BlendMode.%s", (cssValue, expected) => {
    expect(blendModeFor(makeKit(), cssValue)).toBe(expected);
  });

  it("defaults to SrcOver when no blend mode is set", () => {
    expect(blendModeFor(makeKit(), undefined)).toBe("SrcOver");
  });

  it("falls back to SrcOver for a name CanvasKit does not expose, instead of returning undefined", () => {
    const kit = { BlendMode: { SrcOver: "SrcOver" } } as unknown as SkiaCanvasKit;
    expect(blendModeFor(kit, "plus-lighter")).toBe("SrcOver");
  });
});
