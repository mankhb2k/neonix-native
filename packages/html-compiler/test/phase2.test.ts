import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

describe("HTML/CSS compiler Phase 2", () => {
  it("resolves selector cascade, inheritance and nested layer hierarchy", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="card" class="card"><div class="child"></div></div>`,
      css: `body { margin: 0; color: #ffffff; }\n.card { position: absolute; left: 100px; top: 40px; width: 800px; height: 400px; background: #112233; }\n#card { left: 120px; background: #123456; }\n.child { width: 50%; height: 25%; background: #abcdef; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers).toHaveLength(3);
    expect(result.protocol?.layers[0]).toMatchObject({ id: "card", type: "group", frame: { width: 800, height: 400 }, transform: { translate: { x: 120, y: 40 } } });
    expect(result.protocol?.layers[1]).toMatchObject({ id: "card::paint", parentLayerId: "card", style: { fill: "#123456" } });
    expect(result.protocol?.layers[2]).toMatchObject({ parentLayerId: "card", frame: { width: 400, height: 100 }, transform: { translate: { x: 0, y: 0 } }, style: { fill: "#abcdef" } });
  });

  it("normalizes variables, percentages, viewport units, rem and calc", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="unit-box"></div>`,
      css: `:root { --surface: #224466; }\n#unit-box { position: absolute; left: 10vw; top: calc(50% - 20px); width: calc(50% - 24px); height: 2rem; padding: 10px 20px; background: var(--surface); }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]).toMatchObject({ frame: { width: 976, height: 52 }, transform: { translate: { x: 192, y: 520 } }, style: { fill: "#224466" } });
  });

  it("uses variable fallback and reports missing variables", () => {
    const fallback = compileHtmlCss(createHtmlCssSource({ html: `<div id="fallback"></div>`, css: `#fallback { width: 10px; height: 10px; background: var(--missing, #aabbcc); }` }));
    expect(fallback.status).toBe("success");
    expect(fallback.protocol?.layers[0]).toMatchObject({ style: { fill: "#aabbcc" } });
    const missing = compileHtmlCss(createHtmlCssSource({ html: `<div id="missing"></div>`, css: `#missing { width: 10px; height: 10px; background: var(--missing); }` }));
    expect(missing.status).toBe("error");
    expect(missing.diagnostics[0]?.code).toBe("css-variable-missing");
  });

  it("rejects unsupported selectors and keeps deterministic source order", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="x"></div>`, css: `#x:hover { width: 10px; height: 10px; background: #ffffff; }` }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-selector-unsupported");
  });

  it("does not emit a display:none subtree", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="hidden"><div id="child"></div></div>`, css: `#hidden { display: none; width: 10px; height: 10px; } #child { width: 5px; height: 5px; background: #ffffff; }` }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers).toEqual([]);
  });

  it("uses id, then a stable structural path", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="legacy"><span id="child"></span></div>`, css: `#legacy { width: 20px; height: 20px; background: #ffffff; } div > span { width: 5px; height: 5px; background: #00ff00; }` }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-selector-unsupported");

    const stable = compileHtmlCss(createHtmlCssSource({ html: `<div id="legacy"><span id="child"></span></div>`, css: `#legacy { width: 20px; height: 20px; background: #ffffff; } div span { width: 5px; height: 5px; background: #00ff00; }` }));
    expect(stable.status).toBe("success");
    expect(stable.protocol?.layers.map((layer) => layer.id)).toEqual(["legacy", "legacy::paint", "child"]);
  });

  it("rejects duplicate HTML ids", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="same"></div><div id="same"></div>`, css: `#same { width: 10px; height: 10px; }` }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("html-duplicate-atomic-id");
  });
});
