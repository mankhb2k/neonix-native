import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

describe("HTML/CSS compiler Phase 3A layout", () => {
  it("places static block children in deterministic vertical flow", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<main><div id="a"></div><div id="b"></div></main>`, css: `main { width: 400px; height: 400px; padding: 10px; } main div { width: 100px; height: 40px; margin: 5px; background: #ffffff; }` }));
    expect(result.status).toBe("success");
    const a = result.protocol?.layers.find((layer) => layer.id === "a");
    const b = result.protocol?.layers.find((layer) => layer.id === "b");
    expect(a?.transform.translate.y).toBe(15);
    expect(b?.transform.translate.y).toBe(65);
  });

  it("keeps relative parent and absolute child geometry", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="parent"><div id="child"></div></div>`, css: `#parent { position: relative; left: 100px; top: 80px; width: 300px; height: 200px; } #child { position: absolute; left: 20px; top: 30px; width: 50px; height: 40px; background: #ffffff; }` }));
    expect(result.status).toBe("success");
    const child = result.protocol?.layers.find((layer) => layer.id === "child");
    expect(child).toMatchObject({ parentLayerId: "parent", transform: { translate: { x: 20, y: 30 } } });
  });

  it("retains hidden layout state and orders numeric z-index", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="back"></div><div id="front"></div><div id="hidden"></div>`, css: `div { position: absolute; left: 0; top: 0; width: 20px; height: 20px; background: #ffffff; } #back { z-index: 0; } #front { z-index: 2; } #hidden { z-index: 3; visibility: hidden; }` }));
    expect(result.status).toBe("success");
    const layers = result.protocol?.layers ?? [];
    expect(layers.find((layer) => layer.id === "front")?.order).toBeGreaterThan(layers.find((layer) => layer.id === "back")?.order ?? -1);
    expect(layers.find((layer) => layer.id === "hidden")).toMatchObject({ enabled: false });
  });
});
