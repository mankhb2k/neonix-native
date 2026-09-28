import { describe, expect, it } from "vitest";
import { DEFAULT_RAW_HTML_TEMPLATE, validateRawHtmlDocument } from "./validate-raw-html";

const META = '<meta name="neonix-document" content=\'{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1920,"fps":30,"background":"#000000","colorSpace":"srgb"}}\' />';

describe("validateRawHtmlDocument", () => {
  it("accepts the default blank template", () => {
    expect(validateRawHtmlDocument(DEFAULT_RAW_HTML_TEMPLATE)).toEqual([]);
  });

  it("accepts a body with matching inline width/height", () => {
    const html = `<html><head>${META}</head><body style="width:1080px;height:1920px;"><div>hi</div></body></html>`;
    expect(validateRawHtmlDocument(html)).toEqual([]);
  });

  it("accepts a wrapping div with matching width/height when body has none", () => {
    const html = `<html><head>${META}</head><body><div style="width:1080px;height:1920px;">hi</div></body></html>`;
    expect(validateRawHtmlDocument(html)).toEqual([]);
  });

  it("rejects a document with no neonix-document meta tag", () => {
    const html = `<html><head></head><body style="width:1080px;height:1920px;">hi</body></html>`;
    const errors = validateRawHtmlDocument(html);
    expect(errors.some((e) => e.code === "html-document-metadata-missing")).toBe(true);
  });

  it("rejects a document with a <script> tag", () => {
    const html = `<html><head>${META}</head><body style="width:1080px;height:1920px;"><script>alert(1)</script></body></html>`;
    const errors = validateRawHtmlDocument(html);
    expect(errors.some((e) => e.code === "html-script-forbidden")).toBe(true);
  });

  it("rejects a document where neither body nor a wrapper declares matching size", () => {
    const html = `<html><head>${META}</head><body><div>hi</div></body></html>`;
    const errors = validateRawHtmlDocument(html);
    expect(errors.some((e) => e.code === "html-root-size-mismatch")).toBe(true);
  });

  it("rejects a wrapper with mismatched size", () => {
    const html = `<html><head>${META}</head><body><div style="width:500px;height:500px;">hi</div></body></html>`;
    const errors = validateRawHtmlDocument(html);
    expect(errors.some((e) => e.code === "html-root-size-mismatch")).toBe(true);
  });

  it("skips a self-closing top-level element and finds the real wrapper after it", () => {
    const html = `<html><head>${META}</head><body><br/><div style="width:1080px;height:1920px;">hi</div></body></html>`;
    expect(validateRawHtmlDocument(html)).toEqual([]);
  });
});
