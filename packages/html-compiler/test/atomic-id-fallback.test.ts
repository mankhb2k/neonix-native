import { describe, expect, it } from "vitest";
import { compileHtmlCss, compileDocument, createHtmlCssSource } from "../src/index";

// An element with no explicit `id` used to fall back to its full DOM path
// (e.g. `dom/html:0/body:1/div:3/div:3/div:0`) as its Protocol V2 layer id -
// illegible in exported JSON, and every later sibling silently renumbers
// when an element is inserted anywhere earlier in the document. The
// fallback is now the element's own last class (the most specific one in an
// authoring pattern like `class="card card-a"`), or its tag name, deduped
// with a `-2`, `-3`, ... suffix in document order.
function ids(html: string, css = "") {
  const result = compileHtmlCss(createHtmlCssSource({ html, css }));
  expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
  return result.protocol!.layers.map((layer) => layer.id);
}

describe("automatic layer id fallback", () => {
  it("uses the last class as a readable id for an element with no explicit id", () => {
    expect(ids(`<div class="orb orb-a"></div><div class="orb orb-b"></div>`)).toEqual(["orb-a", "orb-b"]);
  });

  it("falls back to the tag name when there is no class either", () => {
    expect(ids(`<div><span></span></div>`)).toEqual(["div", "div::paint", "span"]);
  });

  it("deduplicates repeated class-derived ids with a -2, -3, ... suffix in document order", () => {
    expect(ids(`<span class="label"></span><span class="label"></span><span class="label"></span>`)).toEqual(["label", "label-2", "label-3"]);
  });

  it("never collides an auto-generated id with an explicit id declared later in the document", () => {
    // The first <div> would naturally auto-id to "card", but a later element
    // explicitly claims that id - the auto-id must yield to it even though
    // it hasn't been seen yet when the first div is assigned.
    expect(ids(`<div class="card"></div><span id="card"></span>`)).toEqual(["card-2", "card"]);
  });

  it("keeps every explicit id exactly as authored, unaffected by auto-id dedup", () => {
    expect(ids(`<div id="hero"></div><div class="hero"></div>`)).toEqual(["hero", "hero-2"]);
  });

  it("mints a fresh top-level protocol id on every compile instead of a shared constant", () => {
    const html = `<div id="box"></div>`;
    const a = compileHtmlCss(createHtmlCssSource({ html, css: `#box { width: 10px; height: 10px; background: #fff; }` }));
    const b = compileHtmlCss(createHtmlCssSource({ html, css: `#box { width: 10px; height: 10px; background: #fff; }` }));
    expect(a.protocol?.id).toBeTruthy();
    expect(b.protocol?.id).toBeTruthy();
    expect(a.protocol?.id).not.toBe(b.protocol?.id);
  });

  it("honors an explicit composition.id when the caller supplies one", () => {
    const result = compileHtmlCss(
      createHtmlCssSource({ html: `<div id="box"></div>`, css: `#box { width: 10px; height: 10px; background: #fff; }` }),
      { composition: { id: "my-project-id" } },
    );
    expect(result.protocol?.id).toBe("my-project-id");
  });

  it("also mints a fresh id through compileDocument (the MCP/single-file authoring path)", () => {
    const html = `<!doctype html><html><head><meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'></head><body><div class="hero"></div></body></html>`;
    const a = compileDocument({ html });
    const b = compileDocument({ html });
    expect(a.protocol?.id).not.toBe(b.protocol?.id);
    expect(a.protocol?.layers.map((layer) => layer.id)).toEqual(["hero"]);
  });
});
