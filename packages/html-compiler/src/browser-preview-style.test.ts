import { describe, expect, it } from "vitest";
import { compileDocument } from "./compiler/pipeline/compile";
import { ensureBrowserPreviewBodyStyle } from "./browser-preview-style";

function document(styleContent: string, body = "<div></div>"): string {
  return `<!doctype html>
<html>
  <head>
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
    <style data-neonix-bundle>${styleContent}</style>
  </head>
  <body>${body}</body>
</html>`;
}

describe("ensureBrowserPreviewBodyStyle", () => {
  it("injects the reset rule when html/body has no margin/width/height/overflow at all, using this document's own composition size in exact pixels", () => {
    const input = document("#a { color: red; }");
    const result = ensureBrowserPreviewBodyStyle(input);
    expect(result.injected).toBe(true);
    expect(result.html).toContain("html, body {");
    expect(result.html).toContain("margin: 0;");
    // The fixture's composition is 1080x1080 - a real browser resolves
    // vw/vh/% against its own window, not the composition, so exact pixels
    // (not viewport-relative units) are the only way this actually matches.
    expect(result.html).toContain("width: 1080px;");
    expect(result.html).toContain("height: 1080px;");
    expect(result.html).toContain("overflow: hidden;");
  });

  it("derives the injected pixel size from this specific document's composition, not a fixed default", () => {
    const wide = `<!doctype html>
<html>
  <head>
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
    <style data-neonix-bundle>#a { color: red; }</style>
  </head>
  <body><div id="a"></div></body>
</html>`;
    const result = ensureBrowserPreviewBodyStyle(wide);
    expect(result.injected).toBe(true);
    expect(result.html).toContain("width: 1920px;");
    expect(result.html).toContain("height: 1080px;");
  });

  it("leaves html untouched when the neonix-document metadata is missing or invalid, deferring to the normal compile error", () => {
    const malformed = `<!doctype html><html><head></head><body></body></html>`;
    const result = ensureBrowserPreviewBodyStyle(malformed);
    expect(result).toEqual({ html: malformed, injected: false });
  });

  it("does nothing when html/body already declares all four properties", () => {
    const input = document("html, body { margin: 0; width: 1080px; height: 1080px; overflow: hidden; }");
    const result = ensureBrowserPreviewBodyStyle(input);
    expect(result.injected).toBe(false);
    expect(result.html).toBe(input);
  });

  it("does nothing when the properties are split across separate html/body rules", () => {
    const input = document("html { margin: 0; overflow: hidden; } body { width: 1080px; height: 1080px; }");
    const result = ensureBrowserPreviewBodyStyle(input);
    expect(result.injected).toBe(false);
  });

  it("still injects when only some of the four properties are already declared", () => {
    const input = document("body { margin: 0; }");
    const result = ensureBrowserPreviewBodyStyle(input);
    expect(result.injected).toBe(true);
  });

  it("never changes the compiled composition or layers, only the raw HTML text", () => {
    const input = document("#a { position: absolute; left: 10px; top: 10px; width: 50px; height: 50px; background: #fff; }", `<div id="a"></div>`);
    const before = compileDocument({ html: input });
    const { html } = ensureBrowserPreviewBodyStyle(input);
    const after = compileDocument({ html });
    expect(after.status, JSON.stringify(after.diagnostics)).toBe("success");
    expect(after.protocol?.composition).toEqual(before.protocol?.composition);
    expect(after.protocol?.layers).toEqual(before.protocol?.layers);
  });

  it("is a no-op to run twice in a row (second pass sees its own injected rule)", () => {
    const once = ensureBrowserPreviewBodyStyle(document("#a { color: red; }"));
    const twice = ensureBrowserPreviewBodyStyle(once.html);
    expect(once.injected).toBe(true);
    expect(twice.injected).toBe(false);
    expect(twice.html).toBe(once.html);
  });
});
