import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

describe("HTML/CSS compiler Phase 3A layout", () => {
  it("places static block children in deterministic vertical flow", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<main><div id="a"></div><div id="b"></div></main>`, css: `main { width: 400px; height: 400px; padding: 10px; } main div { width: 100px; height: 40px; margin: 5px; background: #ffffff; }` }));
    expect(result.status).toBe("success");
    const a = result.protocol?.layers.find((layer) => layer.id === "a");
    const b = result.protocol?.layers.find((layer) => layer.id === "b");
    expect(a?.transform.translate.y).toBe(15);
    expect(b?.transform.translate.y).toBe(60);
  });

  it("keeps relative parent and absolute child geometry", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="parent"><div id="child"></div></div>`, css: `#parent { position: relative; left: 100px; top: 80px; width: 300px; height: 200px; } #child { position: absolute; left: 20px; top: 30px; width: 50px; height: 40px; background: #ffffff; }` }));
    expect(result.status).toBe("success");
    const child = result.protocol?.layers.find((layer) => layer.id === "child");
    expect(child).toMatchObject({ parentLayerId: "parent", transform: { translate: { x: 20, y: 30 } } });
  });

  it("resolves aspect-ratio for an auto dimension", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="by-width"></div><div id="by-height"></div>`,
      css: `#by-width { position: absolute; left: 120px; top: 100px; width: 640px; height: auto; aspect-ratio: 16 / 9; background: #14b8a6; } #by-height { position: absolute; left: 900px; top: 100px; width: auto; height: 360px; aspect-ratio: 16 / 9; background: #38bdf8; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "by-width")).toMatchObject({ frame: { width: 640, height: 360 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "by-height")).toMatchObject({ frame: { width: 640, height: 360 } });
  });

  it("resolves aspect-ratio against the box selected by box-sizing", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="content-ratio"></div><div id="border-ratio"></div>`,
      css: `#content-ratio { position: absolute; left: 120px; top: 100px; width: 640px; height: auto; aspect-ratio: 16 / 9; padding: 20px; border: 4px solid #ffffff; box-sizing: content-box; background: #f97316; } #border-ratio { position: absolute; left: 900px; top: 100px; width: 640px; height: auto; aspect-ratio: 16 / 9; padding: 20px; border: 4px solid #ffffff; box-sizing: border-box; background: #a78bfa; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "content-ratio")).toMatchObject({ frame: { width: 688, height: 408 }, style: { strokeWidth: 4 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "border-ratio")).toMatchObject({ frame: { width: 640, height: 360 }, style: { strokeWidth: 4 } });
  });

  it("fails closed for invalid aspect-ratio and box-sizing values", () => {
    const invalidRatio = compileHtmlCss(createHtmlCssSource({ html: `<div id="ratio"></div>`, css: `#ratio { width: 100px; aspect-ratio: 16 / 0; }` }));
    expect(invalidRatio.status).toBe("error");
    expect(invalidRatio.diagnostics[0]?.code).toBe("css-aspect-ratio-invalid");

    const invalidBoxSizing = compileHtmlCss(createHtmlCssSource({ html: `<div id="box"></div>`, css: `#box { width: 100px; box-sizing: fill-box; }` }));
    expect(invalidBoxSizing.status).toBe("error");
    expect(invalidBoxSizing.diagnostics[0]?.code).toBe("css-box-sizing-invalid");
  });

  it("bounds full-size geometry to the fixed composition", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="full"></div>`,
      css: `#full { position: absolute; left: 100px; top: 80px; width: 100%; height: 100%; background: #2563eb; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]).toMatchObject({
      frame: { width: 1820, height: 1000 },
      transform: { translate: { x: 100, y: 80 } },
    });
  });

  it("retains hidden layout state and orders numeric z-index", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="back"></div><div id="front"></div><div id="hidden"></div>`, css: `div { position: absolute; left: 0; top: 0; width: 20px; height: 20px; background: #ffffff; } #back { z-index: 0; } #front { z-index: 2; } #hidden { z-index: 3; visibility: hidden; }` }));
    expect(result.status).toBe("success");
    const layers = result.protocol?.layers ?? [];
    expect(layers.find((layer) => layer.id === "front")?.order).toBeGreaterThan(layers.find((layer) => layer.id === "back")?.order ?? -1);
    expect(layers.find((layer) => layer.id === "hidden")).toMatchObject({ enabled: false });
  });
});
