import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

function compile(css: string) {
  const result = compileHtmlCss(createHtmlCssSource({
    html: `<div id="backdrop"></div>`,
    css: `#backdrop { position: absolute; left: 100px; top: 80px; width: 320px; height: 180px; background: #38bdf8aa; ${css} }`,
  }));
  expect(result.status).toBe("success");
  return result.protocol?.layers.find((layer) => layer.id === "backdrop");
}

describe("HTML/CSS compiler backdrop-filter", () => {
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
