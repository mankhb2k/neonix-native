import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

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
    const layer = compile("background: #14b8a6; border: 8px solid #ffffff; border-radius: 24px;");
    expect(layer).toMatchObject({
      payload: { shape: "rectangle", cornerRadius: 24 },
      style: { fill: "#14b8a6", stroke: "#ffffff", strokeWidth: 8 },
    });
  });

  it("lowers linear and radial gradients with normalized multi-stop colors", () => {
    const linear = compile("background: linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%);");
    expect(linear?.style.fill).toMatchObject({ type: "linear-gradient", angle: 90, stops: [
      { offset: 0, color: "#ff0000" }, { offset: 0.5, color: "#00ff00" }, { offset: 1, color: "#0000ff" },
    ] });
    const radial = compile("background: radial-gradient(circle at 25% 75%, #ffffff, #000000 80%);");
    expect(radial?.style.fill).toMatchObject({ type: "radial-gradient", cx: 0.25, cy: 0.75, stops: [{ offset: 0, color: "#ffffff" }, { offset: 0.8, color: "#000000" }] });
  });

  it("lowers conic gradients and preserves multiple background layer order", () => {
    const conic = compile("background: conic-gradient(from 45deg at 50% 50%, #ff0000, #0000ff 50%, #00ff00);");
    expect(conic?.style.fill).toMatchObject({ type: "conic-gradient", from: 45, cx: 0.5, cy: 0.5, stops: [{ offset: 0 }, { offset: 0.5 }, { offset: 1 }] });
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="paint"></div>`, css: `#paint { width: 100px; height: 100px; background: linear-gradient(90deg, #ff0000, #0000ff), #101820; }` }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.map((layer) => layer.id)).toEqual(["paint::paint:0", "paint::paint:1"]);
  });

  it("rejects non-uniform radius instead of silently approximating CSS", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="paint"></div>`, css: `#paint { width: 100px; height: 100px; background: #fff; border-radius: 8px 16px; }` }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-border-radius-unsupported");
  });
});
