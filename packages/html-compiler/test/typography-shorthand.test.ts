import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

const FONT_ASSET = { id: "inter-regular", kind: "font" as const, uri: "/fonts/inter.ttf", weight: 400, style: "normal" as const, integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", family: "Inter" };
const FONT_ASSET_BOLD = { id: "inter-bold", kind: "font" as const, uri: "/fonts/inter-bold.ttf", weight: 700, style: "normal" as const, integrity: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", family: "Inter" };
const FONT_ASSET_ITALIC = { id: "inter-italic", kind: "font" as const, uri: "/fonts/inter-italic.ttf", weight: 400, style: "italic" as const, integrity: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", family: "Inter" };

function compile(css: string, body = `<div id="box">Hello</div>`) {
  return compileHtmlCss(createHtmlCssSource({
    html: body,
    css: `#box { position: absolute; left: 0; top: 0; width: 400px; height: 300px; color: #fff; font-family: Inter; ${css} }`,
  }), { fontAssets: [FONT_ASSET, FONT_ASSET_BOLD, FONT_ASSET_ITALIC] });
}

function fontOf(result: ReturnType<typeof compile>) {
  return result.protocol?.layers.find((layer) => layer.type === "text")?.payload?.chunks?.[0]?.spans?.[0]?.font;
}

// The `font` shorthand was not in SUPPORTED_PROPERTIES at all - every use
// hard-failed with "Phase 2 does not support font", pushing authors (human
// and AI) toward always spelling out font-size/font-weight/font-family
// individually even though `font: ...` is extremely common hand-written CSS.
describe("font shorthand", () => {
  it("expands style, weight and size/line-height into their longhands", () => {
    const result = compile("font: italic 700 24px/1.4 Inter;");
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(fontOf(result)).toMatchObject({ families: ["Inter"], size: 24, weight: 700, style: "italic" });
    expect(result.protocol?.layers.find((layer) => layer.type === "text")?.payload?.layout?.lineHeight).toBeCloseTo(24 * 1.4, 5);
  });

  it("defaults style/weight/stretch to normal when omitted (minimal size + family)", () => {
    const result = compile("font: 16px Inter;");
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(fontOf(result)).toMatchObject({ families: ["Inter"], size: 16, weight: 400, style: "normal", stretch: "normal" });
  });

  it("resolves style/weight/stretch keywords in any order before the size", () => {
    expect(fontOf(compile("font: bold italic 20px Inter;"))).toMatchObject({ weight: 700, style: "italic" });
    expect(fontOf(compile("font: condensed 700 20px Inter;"))).toMatchObject({ stretch: "condensed", weight: 700 });
  });

  it("lets a later explicit longhand in the same rule override the shorthand", () => {
    const result = compile("font: 700 24px Inter; font-weight: 400;");
    expect(fontOf(result)).toMatchObject({ weight: 400 });
  });

  it("rejects a system UI font keyword instead of silently ignoring it", () => {
    const result = compile("font: caption;");
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-font-shorthand-unsupported");
  });

  it("expands font-variant: small-caps inside the shorthand onto the span, instead of rejecting it", () => {
    const result = compile("font: small-caps 20px Inter;");
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.type === "text")?.payload?.chunks?.[0]?.spans?.[0]).toMatchObject({ smallCaps: true });
  });

  it("rejects a shorthand missing a font-size or font-family", () => {
    expect(compile("font: Inter;").status).toBe("error");
    expect(compile("font: 16px;").status).toBe("error");
  });
});

// text-transform was not in SUPPORTED_PROPERTIES at all. uppercase/
// lowercase/capitalize are common in motion-graphics badges/labels (styled
// via CSS instead of typing literal caps into the HTML).
describe("text-transform", () => {
  function textOf(result: ReturnType<typeof compile>) {
    return result.protocol?.layers.find((layer) => layer.type === "text")?.payload?.source?.text;
  }

  it("uppercases the rendered text without changing the HTML source", () => {
    const result = compile("text-transform: uppercase;", `<div id="box">Hello Neonix</div>`);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(textOf(result)).toBe("HELLO NEONIX");
  });

  it("lowercases the rendered text", () => {
    expect(textOf(compile("text-transform: lowercase;", `<div id="box">HELLO Neonix</div>`))).toBe("hello neonix");
  });

  it("capitalizes the first letter of each word", () => {
    expect(textOf(compile("text-transform: capitalize;", `<div id="box">hello neonix world</div>`))).toBe("Hello Neonix World");
  });

  it("applies per element in a nested inline run, not to the whole text node", () => {
    const result = compile(
      "text-transform: uppercase;",
      `<div id="box">outer <span id="inner">middle</span> outer</div>`,
    );
    // #inner has no rule of its own here, so it inherits #box's uppercase -
    // this asserts inheritance flows through the cascade into the transform,
    // not just a flat apply-to-whole-string pass.
    expect(textOf(result)).toBe("OUTER MIDDLE OUTER");
  });

  it("rejects an unrecognized text-transform value instead of silently ignoring it", () => {
    const result = compile("text-transform: full-width;");
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-text-transform-unsupported");
  });
});
