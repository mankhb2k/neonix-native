import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

function compile(css: string) {
  const result = compileHtmlCss(createHtmlCssSource({
    html: `<div id="backdrop"></div>`,
    css: `#backdrop { position: absolute; left: 100px; top: 80px; width: 320px; height: 180px; background: #38bdf8aa; ${css} }`,
  }));
  expect(result.status).toBe("success");
  return result.protocol?.layers.find((layer) => layer.id === "backdrop");
}

describe("HTML/CSS compiler backdrop-filter", () => {
  it("emits a rounded semantic clip for a leaf backdrop surface", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="backdrop"></div>`,
      css: `#backdrop { position: absolute; left: 100px; top: 80px; width: 320px; height: 180px; border-radius: 28px; background: #38bdf8aa; backdrop-filter: blur(12px); }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "backdrop")).toMatchObject({
      type: "group",
      clipPath: "html-backdrop-clip-0",
      backdropEffects: [{ id: "filter:0", type: "blur", radius: 12 }],
    });
    expect(result.protocol?.clipPaths).toEqual([{
      id: "html-backdrop-clip-0",
      clipPathUnits: "userSpaceOnUse",
      children: [{ type: "rect", x: 0, y: 0, width: 320, height: 180, rx: 28, ry: 28 }],
    }]);
  });

  it("keeps backdrop-filter separate from the layer filter", () => {
    const layer = compile("filter: brightness(0.8); backdrop-filter: blur(12px) contrast(1.4);");
    expect(layer).toMatchObject({
      opacity: 1,
      backdropEffects: [
        { id: "filter:0", type: "blur", radius: 12 },
        { id: "filter:1", type: "color-adjust", contrast: 1.4 },
      ],
      effects: [{ id: "filter:0", type: "color-adjust", brightness: -0.09999999999999998, contrast: 0.8 }],
    });
  });

  it("preserves the authored backdrop filter order", () => {
    const layer = compile("backdrop-filter: brightness(0.8) blur(8px) contrast(1.2);");
    expect(layer && "backdropEffects" in layer ? layer.backdropEffects?.map((effect) => effect.type) : []).toEqual([
      "color-adjust",
      "blur",
      "color-adjust",
    ]);
  });
});
