import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

function compile(css: string) {
  const result = compileHtmlCss(createHtmlCssSource({
    html: `<div id="paint"></div>`,
    css: `#paint { position: absolute; left: 120px; top: 120px; width: 720px; height: 420px; ${css} }`,
  }));
  expect(result.status).toBe("success");
  return result.protocol?.layers.find((layer) => layer.id === "paint");
}

describe("HTML/CSS compiler P2.1 repeating gradients", () => {
  it("normalizes a short repeating linear period and preserves wrap stops", () => {
    const layer = compile("background: repeating-linear-gradient(90deg, #38bdf8 0%, #a78bfa 12.5%);");
    expect(layer?.style.fill).toMatchObject({
      type: "linear-gradient",
      angle: 0,
      spreadMethod: "repeat",
      stops: [{ offset: 0, color: "#38bdf8" }, { offset: 0.125, color: "#a78bfa" }],
    });
  });

  it("keeps an off-center repeating radial center and period", () => {
    const layer = compile("background: repeating-radial-gradient(circle at 25% 65%, #f8fafc 0%, #38bdf8 18%, #1e3a8a 36%);");
    expect(layer?.style.fill).toMatchObject({
      type: "radial-gradient",
      cx: 0.25,
      cy: 0.65,
      spreadMethod: "repeat",
      stops: [{ offset: 0 }, { offset: 0.18 }, { offset: 0.36 }],
    });
  });

  it("keeps the conic from angle, off-center and repeating stop sequence", () => {
    const layer = compile("background: repeating-conic-gradient(from 45deg at 30% 60%, #facc15 0%, #fb7185 25%, #38bdf8 50%);");
    expect(layer?.style.fill).toMatchObject({
      type: "conic-gradient",
      from: 45,
      cx: 0.3,
      cy: 0.6,
      spreadMethod: "repeat",
      stops: [{ offset: 0 }, { offset: 0.25 }, { offset: 0.5 }],
    });
  });

  it("keeps a repeating gradient above a solid background layer", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="paint"></div>`,
      css: `#paint { width: 720px; height: 420px; background: repeating-linear-gradient(90deg, #38bdf8 0%, #38bdf8 10%, #00000000 10%, #00000000 20%), #172554; }`,
    }));
    expect(result.status).toBe("success");
    const layers = result.protocol?.layers.filter((layer) => layer.id.startsWith("paint::paint:")) ?? [];
    expect(layers).toHaveLength(2);
    expect(layers[0]?.style.fill).toMatchObject({ type: "linear-gradient", spreadMethod: "repeat" });
    expect(layers[1]?.style.fill).toBe("#172554");
    expect(layers[0]?.order).toBeGreaterThan(layers[1]?.order ?? Number.POSITIVE_INFINITY);
  });
});
