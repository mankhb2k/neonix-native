import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

const FONT_ASSET = { id: "inter-regular", kind: "font" as const, uri: "/fonts/inter.ttf", weight: 400, style: "normal" as const, integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", family: "Inter" };

function compile(css: string, body: string) {
  return compileHtmlCss(createHtmlCssSource({ html: body, css }), { fontAssets: [FONT_ASSET] });
}

function textLayer(result: ReturnType<typeof compile>) {
  return result.protocol?.layers.find((layer) => layer.type === "text");
}

// `text-indent` was not in SUPPORTED_PROPERTIES at all. It's the standard
// way to indent a paragraph's first line (common in longer captions/body
// copy) and, being inherited, needed to flow through the whole
// html-compiler -> motion-protocol -> motion-compiler -> motion-runtime
// chain, not just html-compiler.
describe("text-indent", () => {
  it("resolves a length and passes it through to the layout payload", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-indent: 40px; }`,
      `<body><div id="box">Hello world</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(textLayer(result)?.payload.layout.textIndent).toBe(40);
  });

  it("resolves a negative em-relative length (hanging indent)", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-indent: -2em; }`,
      `<body><div id="box">Hello world</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(textLayer(result)?.payload.layout.textIndent).toBe(-40);
  });

  it("inherits from an ancestor, like real CSS text-indent", () => {
    const result = compile(
      `#parent { text-indent: 30px; } #box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; }`,
      `<body><div id="parent"><div id="box">Hello world</div></div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(textLayer(result)?.payload.layout.textIndent).toBe(30);
  });

  it("omits the field entirely at the default (0), instead of emitting a no-op 0", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; }`,
      `<body><div id="box">Hello world</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(textLayer(result)?.payload.layout.textIndent).toBeUndefined();
  });

  it("rejects a non-length value instead of silently ignoring it", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-indent: not-a-length; }`,
      `<body><div id="box">Hello world</div></body>`,
    );
    expect(result.status).toBe("error");
  });
});

// `font-variant` was not in SUPPORTED_PROPERTIES at all; only `small-caps`
// is supported (the Protocol V2 span field it maps to, smallCaps, is a
// boolean, not a full font-variant model).
describe("font-variant: small-caps", () => {
  function spanOf(result: ReturnType<typeof compile>) {
    return textLayer(result)?.payload.chunks[0]?.spans[0];
  }

  it("sets smallCaps on the span", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; font-variant: small-caps; }`,
      `<body><div id="box">Hello world</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(spanOf(result)).toMatchObject({ smallCaps: true });
  });

  it("leaves smallCaps unset for font-variant: normal (the default)", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; font-variant: normal; }`,
      `<body><div id="box">Hello world</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(spanOf(result)?.smallCaps).toBeUndefined();
  });

  it("rejects an unsupported font-variant value instead of silently ignoring it", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; font-variant: all-small-caps; }`,
      `<body><div id="box">Hello world</div></body>`,
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-font-variant-unsupported");
  });
});
