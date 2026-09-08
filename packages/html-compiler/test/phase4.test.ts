import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

function compile(css: string) {
  const result = compileHtmlCss(createHtmlCssSource({
    html: `<div id="paint"></div>`,
    css: `#paint { position: absolute; left: 100px; top: 80px; width: 400px; height: 240px; ${css} }`,
  }));
  expect(result.status).toBe("success");
  return result.protocol?.layers.find((layer) => layer.id === "paint");
}

describe("HTML/CSS compiler Phase 4 paint", () => {
  it("lowers a uniform rounded rectangle and solid border", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="paint"></div>`,
      css: `#paint { position: absolute; left: 100px; top: 80px; width: 400px; height: 240px; background: #14b8a6; border: 8px solid #ffffff; border-radius: 24px; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "paint")).toMatchObject({ type: "group", frame: { width: 416, height: 256 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "paint::paint")).toMatchObject({
      payload: { shape: "rectangle", cornerRadius: 24 },
      style: { fill: "#14b8a6" },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "paint::border")).toMatchObject({
      frame: { width: 408, height: 248 },
      transform: { translate: { x: 4, y: 4 } },
      payload: { shape: "rectangle", cornerRadius: 20 },
      style: { fill: "#00000000", stroke: "#ffffff", strokeWidth: 8 },
    });
  });

  it("resolves color/currentColor and border longhands including none", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="solid"></div><div id="none"></div>`,
      css: `#solid { color: #38bdf8; width: 200px; height: 100px; background-color: #172554; border-width: 8px; border-style: solid; border-color: currentColor; border-radius: 20px; } #none { width: 200px; height: 100px; background: #172554; border: 8px none #fb7185; border-radius: 20px; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "solid")).toMatchObject({ type: "group", frame: { width: 216, height: 116 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "solid::paint")).toMatchObject({
      frame: { width: 216, height: 116 },
      payload: { cornerRadius: 20 },
      style: { fill: "#172554" },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "solid::border")).toMatchObject({ style: { stroke: "#38bdf8", strokeWidth: 8 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "none")).not.toHaveProperty("style.stroke");
  });

  it("lowers linear and radial gradients with normalized multi-stop colors", () => {
    const linear = compile("background: linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%);");
    expect(linear?.style.fill).toMatchObject({ type: "linear-gradient", angle: 0, stops: [
      { offset: 0, color: "#ff0000" }, { offset: 0.5, color: "#00ff00" }, { offset: 1, color: "#0000ff" },
    ] });
    const defaultLinear = compile("background: linear-gradient(#ff0000, #0000ff);");
    expect(defaultLinear?.style.fill).toMatchObject({ type: "linear-gradient", angle: 90 });
    const radial = compile("background: radial-gradient(circle at 25% 75%, #ffffff, #000000 80%);");
    expect(radial?.style.fill).toMatchObject({ type: "radial-gradient", cx: 0.25, cy: 0.75, stops: [{ offset: 0, color: "#ffffff" }, { offset: 0.8, color: "#000000" }] });
    const ellipse = compile("background: radial-gradient(ellipse at 70% 45%, #ffffff 0%, #000000 70%);");
    expect(ellipse?.style.fill).toMatchObject({ type: "radial-gradient", cx: 0.7, cy: 0.45 });
    expect((ellipse?.style.fill as { radiusX: number; radiusY: number }).radiusX).toBeCloseTo(0.7 * Math.SQRT2, 8);
    expect((ellipse?.style.fill as { radiusX: number; radiusY: number }).radiusY).toBeCloseTo(0.55 * Math.SQRT2, 8);
  });

  it("lowers conic gradients and preserves multiple background layer order", () => {
    const conic = compile("background: conic-gradient(from 45deg at 50% 50%, #ff0000, #0000ff 50%, #00ff00);");
    expect(conic?.style.fill).toMatchObject({ type: "conic-gradient", from: 45, cx: 0.5, cy: 0.5, stops: [{ offset: 0 }, { offset: 0.5 }, { offset: 1 }] });
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="paint"></div>`, css: `#paint { width: 100px; height: 100px; background: linear-gradient(90deg, #ff0000, #0000ff), #101820; }` }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.map((layer) => layer.id)).toEqual(["paint::paint:0", "paint::paint:1"]);
    expect(result.protocol?.layers[0]?.order).toBeGreaterThan(result.protocol?.layers[1]?.order ?? Number.POSITIVE_INFINITY);
  });

  it("lowers non-uniform radius into deterministic path geometry", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="paint"></div>`, css: `#paint { width: 100px; height: 100px; background: #fff; border-radius: 8px 16px; }` }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.some((layer) => layer.id.startsWith("paint:fill:") && layer.type === "shape")).toBe(true);
  });

  it("preserves explicit SVG path fill none separately from the black default", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<svg><path id="stroke-only" d="M 0 0 L 100 0 L 50 80 Z"></path><path id="default-fill" d="M 0 0 L 100 0 L 50 80 Z"></path></svg>`,
      css: `svg { width: 120px; height: 100px; } #stroke-only { fill: none; stroke: #facc15; stroke-width: 8px; } #default-fill { transform: translateX(0px); }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "stroke-only")).toMatchObject({ style: { fill: "none", stroke: "#facc15" } });
    expect(result.protocol?.layers.find((layer) => layer.id === "default-fill")).toMatchObject({ style: { fill: "#000000" } });
  });
});
