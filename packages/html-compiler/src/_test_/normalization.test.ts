import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

describe("HTML/CSS normalization contract", () => {
  it("canonicalizes identity precedence and structural fallback", () => {
    const explicit = compileHtmlCss(createHtmlCssSource({
      html: `<div id="legacy" data-atomic-id="hero"></div>`,
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
      "dom/div:0",
      "dom/div:0::paint",
      "dom/div:0/span:0",
    ]);
  });

  it("does not treat data-atomic-id as a CSS id selector", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div data-atomic-id="hero"></div>`,
      css: `#hero { width: 10px; height: 10px; background: #ffffff; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]).toMatchObject({ id: "hero", style: { fill: "#00000000" } });
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
    const unsupported = compileHtmlCss(createHtmlCssSource({ html: `<div id="color"></div>`, css: `#color { width: 10px; height: 10px; background: rgb(1, 2, 3); }` }));
    expect(unsupported.diagnostics[0]?.code).toBe("css-color-unsupported");
  });

  it("deduplicates classes without changing selector matching", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="card" class="card card"></div>`, css: `.card { width: 10px; height: 10px; background: #ffffff; }` }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers[0]?.id).toBe("card");
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

  it("fails closed for cascade features outside the visual subset", () => {
    const important = compileHtmlCss(createHtmlCssSource({ html: `<div id="box"></div>`, css: `#box { width: 10px !important; height: 10px; background: #ffffff; }` }));
    expect(important.status).toBe("error");
    expect(important.diagnostics[0]?.code).toBe("css-important-unsupported");
    expect(important.diagnostics[0]?.source).toMatchObject({ kind: "css", line: 1 });
  });

  it("rejects runtime behavior from the visual-only source contract", () => {
    const result = compileHtmlCss(createHtmlCssSource({ html: `<div id="box" onclick="alert(1)"></div>`, css: `` }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("html-event-unsupported");
    expect(result.diagnostics[0]?.source).toMatchObject({ kind: "html", line: 1, column: 1 });
  });
});
