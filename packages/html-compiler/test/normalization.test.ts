import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

describe("HTML/CSS normalization contract", () => {
  it("uses the standard HTML id, or a readable class/tag fallback, as the layer id", () => {
    const explicit = compileHtmlCss(createHtmlCssSource({
      html: `<div id="hero"></div>`,
      css: `#legacy { width: 10px; height: 10px; background: #ffffff; }`,
    }));
    expect(explicit.status).toBe("success");
    expect(explicit.protocol?.layers[0]?.id).toBe("hero");

    const fallback = compileHtmlCss(createHtmlCssSource({
      html: `<div><span></span></div>`,
      css: `span { width: 10px; height: 10px; background: #ffffff; }`,
    }));
    expect(fallback.status).toBe("success");
    expect(fallback.protocol?.layers.map((layer) => layer.id)).toEqual([
      "div",
      "div::paint",
      "span",
    ]);
  });

  it("rejects the removed data-atomic-id attribute", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="hero" data-atomic-id="hero"></div>`,
      css: `#hero { width: 10px; height: 10px; background: #ffffff; }`,
    }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("html-attribute-unsupported");
  });

  it("rejects invalid or duplicate explicit identities and class tokens", () => {
    const invalidId = compileHtmlCss(createHtmlCssSource({ html: `<div id="bad identity"></div>`, css: `` }));
    expect(invalidId.diagnostics[0]?.code).toBe("html-identity-invalid");
    const duplicate = compileHtmlCss(createHtmlCssSource({ html: `<div id="same"></div><span id="same"></span>`, css: `` }));
    expect(duplicate.diagnostics[0]?.code).toBe("html-duplicate-atomic-id");
    const invalidClass = compileHtmlCss(createHtmlCssSource({ html: `<div class="good bad.token"></div>`, css: `` }));
    expect(invalidClass.diagnostics[0]?.code).toBe("html-class-invalid");
  });

  it("normalizes colors to lowercase hex and expands shorthand", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="color"></div>`, css: `#color { width: 10px; height: 10px; background: #AbC; }` }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]).toMatchObject({ style: { fill: "#aabbcc" } });
    // rgb() (legacy comma syntax) resolves to hex like rgba()/hsl() do.
    const rgb = compileHtmlCss(createHtmlCssSource({ html: `<div id="color"></div>`, css: `#color { width: 10px; height: 10px; background: rgb(1, 2, 3); }` }));
    expect(rgb.protocol?.layers[0]).toMatchObject({ style: { fill: "#010203ff" } });
    const unsupported = compileHtmlCss(createHtmlCssSource({ html: `<div id="color"></div>`, css: `#color { width: 10px; height: 10px; background: oklch(0.7 0.15 30); }` }));
    expect(unsupported.diagnostics[0]?.code).toBe("css-color-unsupported");
  });

  it("deduplicates classes without changing selector matching", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="card" class="card card"></div>`, css: `.card { width: 10px; height: 10px; background: #ffffff; }` }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]?.id).toBe("card");
  });

  it("normalizes initial, inherit and unset against property inheritance", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="parent"><div id="child"></div></div>`,
      css: `#parent { width: 200px; height: 100px; color: #123456; }
#child { width: initial; height: unset; color: inherit; background: currentColor; }`,
    }));
    expect(result.status).toBe("success");
    const child = result.protocol?.layers.find((layer) => layer.id === "child");
    expect(child).toMatchObject({ frame: { width: 200, height: 100 }, style: { fill: "#123456" } });
  });

  it("supports min, max and clamp value normalization", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="box"></div>`,
      css: `#box { position: absolute; width: min(80%, 400px); height: clamp(100px, 50vh, 700px); left: max(10px, 2vw); }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]).toMatchObject({ frame: { width: 400, height: 540 }, transform: { translate: { x: 38.4, y: 0 } } });
  });

  it("lets longhands participate in source-order cascade with shorthands", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="box"></div>`,
      css: `#box { position: absolute; width: 100px; height: 100px; box-sizing: border-box; background: #112233; background-color: #445566; border: 4px solid #ffffff; border-width: 8px; padding: 10px; padding-left: 24px; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "box")).toMatchObject({ type: "group", frame: { width: 100, height: 100 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "box::paint")).toMatchObject({ style: { fill: "#445566" } });
    expect(result.protocol?.layers.find((layer) => layer.id === "box::border")).toMatchObject({ style: { strokeWidth: 8 } });
  });

  it("accepts only the Phase 2 visual/container tag allowlist", () => {
    const supported = compileHtmlCss(createHtmlCssSource({
      html: `<main><section><article><div id="box"></div></article></section></main>`,
      css: `#box { width: 10px; height: 10px; background: #ffffff; }`,
    }));
    expect(supported.status).toBe("success");
    const unsupported = compileHtmlCss(createHtmlCssSource({
      html: `<button id="button"></button>`,
      css: `#button { width: 10px; height: 10px; background: #ffffff; }`,
    }));
    expect(unsupported.status).toBe("error");
    expect(unsupported.diagnostics[0]?.code).toBe("html-tag-unsupported");
    expect(unsupported.diagnostics[0]?.source).toMatchObject({ kind: "html", line: 1, column: 1 });
  });

  it("resolves important declarations after specificity and before source order", () => {
    const important = compileHtmlCss(createHtmlCssSource({ html: `<div id="box"></div>`, css: `#box { width: 10px !important; height: 10px; background: #ffffff; }` }));
    expect(important.status).toBe("success");
    expect(important.protocol?.layers[0]).toMatchObject({ frame: { width: 10, height: 10 } });
    const cascade = compileHtmlCss(createHtmlCssSource({ html: `<div id="box" class="box"></div>`, css: `.box { width: 20px !important; } #box { width: 30px; }` }));
    expect(cascade.protocol?.layers[0]?.frame.width).toBe(20);
  });

  it("rejects runtime behavior from the visual-only source contract", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="box" onclick="alert(1)"></div>`, css: `` }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("html-event-unsupported");
    expect(result.diagnostics[0]?.source).toMatchObject({ kind: "html", line: 1, column: 1 });
  });
});
