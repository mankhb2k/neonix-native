import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

function compile(css: string) {
  return compileHtmlCss(createHtmlCssSource({
    html: `<div id="subject"></div><div id="label"></div>`,
    css: `body { margin: 0; }
#subject { position: absolute; left: 200px; top: 160px; width: 240px; height: 120px; background: #38bdf8; anchor-name: --subject; }
#label { position: absolute; width: 120px; height: 40px; background: #fb7185; ${css} }`,
  }));
}

describe("HTML/CSS compiler anchor positioning", () => {
  it("resolves anchor edges into the target frame", () => {
    const result = compile("position-anchor: --subject; left: anchor(--subject right); top: anchor(--subject bottom); width: anchor-size(--subject width);");
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "label")).toMatchObject({ frame: { width: 240, height: 40 }, transform: { translate: { x: 440, y: 280 } } });
  });

  it("supports the implicit position-anchor name", () => {
    const result = compile("position-anchor: --subject; left: anchor(right); top: anchor(top);");
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "label")).toMatchObject({ transform: { translate: { x: 440, y: 160 } } });
  });

  it("resolves right and bottom against the containing block edge", () => {
    const result = compile("position-anchor: --subject; right: anchor(--subject left); bottom: anchor(--subject top);");
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "label")).toMatchObject({ transform: { translate: { x: 80, y: 120 } } });
  });

  it("uses explicit px fallbacks for missing anchors", () => {
    const result = compile("left: anchor(--missing right, 32px); top: anchor(--missing top, 24px);");
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "label")).toMatchObject({ transform: { translate: { x: 32, y: 24 } } });
  });

  it("reports missing references instead of emitting unresolved geometry", () => {
    const result = compile("left: anchor(--missing right); top: 10px;");
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-anchor-reference-missing");
  });
});
