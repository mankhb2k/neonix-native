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

  it("resolves absolute children from a positioned parent's padding box", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="card"><div id="background"></div><div id="accent"></div></div>`,
      css: `#card { position: relative; width: 880px; height: 560px; padding: 40px; box-sizing: border-box; } #background { width: 800px; height: 480px; background: #172554; } #accent { position: absolute; left: 40px; top: 40px; width: 240px; height: 18px; background: #38bdf8; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "background")).toMatchObject({
      transform: { translate: { x: 40, y: 40 } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "accent")).toMatchObject({
      transform: { translate: { x: 40, y: 40 } },
    });
  });

  it("keeps static and relative boxes in flow while absolute leaves it", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="flow"><div id="static"></div><div id="relative"></div><div id="after"></div><div id="absolute"></div></div>`,
      css: `#flow { position: relative; left: 100px; top: 80px; width: 600px; height: 500px; } #static { position: static; left: 400px; top: 400px; margin: 10px 0 20px 20px; width: 100px; height: 40px; background: #38bdf8; } #relative { position: relative; left: 30px; top: 12px; margin: 15px 0 25px 20px; width: 100px; height: 40px; background: #a78bfa; } #after { position: static; margin-top: 10px; width: 100px; height: 40px; background: #facc15; } #absolute { position: absolute; left: 200px; top: 100px; width: 100px; height: 40px; background: #fb7185; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "static")).toMatchObject({
      transform: { translate: { x: 20, y: 10 } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "relative")).toMatchObject({
      transform: { translate: { x: 50, y: 82 } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "after")).toMatchObject({
      transform: { translate: { x: 0, y: 135 } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "absolute")).toMatchObject({
      transform: { translate: { x: 200, y: 100 } },
    });
  });

  it("expands inset and resolves opposite absolute edges", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="container"><div id="inset"></div><div id="corner"></div></div>`,
      css: `#container { position: relative; width: 600px; height: 500px; } #inset { position: absolute; inset: 40px 80px 60px 100px; width: auto; height: auto; background: #14b8a6; } #corner { position: absolute; right: 100px; bottom: 80px; width: 50px; height: 70px; background: #f97316; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "inset")).toMatchObject({
      frame: { width: 420, height: 400 },
      transform: { translate: { x: 100, y: 40 } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "corner")).toMatchObject({
      frame: { width: 50, height: 70 },
      transform: { translate: { x: 450, y: 350 } },
    });
  });

  it("flattens display contents, omits display none, and preserves hidden visibility", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="container"><div id="block"></div><div id="contents"><div id="contents-a"></div><div id="contents-b"></div></div><div id="none"></div><div id="hidden"></div></div>`,
      css: `#container { width: 400px; height: 400px; } #block { display: block; margin: 10px 0 20px; width: 100px; height: 40px; background: #38bdf8; } #contents { display: contents; } #contents-a, #contents-b { display: block; margin: 5px 0; width: 100px; height: 30px; background: #a78bfa; } #none { display: none; width: 200px; height: 80px; background: #fb7185; } #hidden { display: block; visibility: hidden; margin-top: 10px; width: 100px; height: 30px; background: #facc15; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "block")).toMatchObject({
      type: "shape",
      transform: { translate: { x: 0, y: 10 } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "contents")).toBeUndefined();
    expect(result.protocol?.layers.find((layer) => layer.id === "contents-a")).toMatchObject({
      transform: { translate: { x: 0, y: 70 } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "contents-b")).toMatchObject({
      transform: { translate: { x: 0, y: 105 } },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "none")).toBeUndefined();
    expect(result.protocol?.layers.find((layer) => layer.id === "hidden")).toMatchObject({
      enabled: false,
      transform: { translate: { x: 0, y: 145 } },
    });
  });

  it("lowers opacity, z-index, and overflow hidden to V2 contracts", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="hidden-overflow"><div id="overflowing-child"></div></div><div id="visible-overflow"><div id="visible-child"></div></div><div id="back"></div><div id="front"></div>`,
      css: `#hidden-overflow, #visible-overflow { position: relative; width: 300px; height: 150px; } #hidden-overflow { overflow: hidden; opacity: 0.5; z-index: 2; } #visible-overflow { overflow: visible; } #overflowing-child, #visible-child { position: absolute; left: 220px; top: 20px; width: 160px; height: 60px; background: #f97316; } #back, #front { position: absolute; left: 800px; top: 100px; width: 100px; height: 100px; background: #38bdf8; } #back { z-index: 1; } #front { z-index: 3; opacity: 0.75; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "hidden-overflow")).toMatchObject({
      opacity: 0.5,
      clipPath: "html-overflow-clip-0",
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "visible-overflow")).not.toHaveProperty("clipPath");
    expect(result.protocol?.layers.find((layer) => layer.id === "front")).toMatchObject({ opacity: 0.75 });
    expect(result.protocol?.layers.find((layer) => layer.id === "front")?.order).toBeGreaterThan(result.protocol?.layers.find((layer) => layer.id === "back")?.order ?? -1);
    expect(result.protocol?.clipPaths?.[0]).toMatchObject({
      id: "html-overflow-clip-0",
      clipPathUnits: "userSpaceOnUse",
      children: [{ type: "rect", x: 0, y: 0, width: 300, height: 150 }],
    });
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
