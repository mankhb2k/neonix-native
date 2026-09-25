import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

const FONT_ASSET = { id: "inter-regular", kind: "font" as const, uri: "/fonts/inter.ttf", weight: 400, style: "normal" as const, integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", family: "Inter" };

function compile(css: string, body: string) {
  return compileHtmlCss(createHtmlCssSource({ html: body, css }), { fontAssets: [FONT_ASSET] });
}

function wrapOf(result: ReturnType<typeof compile>) {
  return result.protocol?.layers.find((layer) => layer.type === "text")?.payload.layout.wrap;
}

// `word-break` and `overflow-wrap`/`word-wrap` were not in SUPPORTED_PROPERTIES
// at all. Both lower to the Protocol V2 `wrap` enum's new `character`/
// `word-break-long` values, whose actual wrapping algorithms already have
// real-HarfBuzz tests in motion-runtime's text-layout.test.ts - these tests
// only need to confirm html-compiler routes each CSS spelling to the right
// enum value (and inherits/cascades correctly), not re-verify the wrapping
// math itself.
describe("word-break and overflow-wrap", () => {
  it("word-break: break-all maps to wrap: character", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; word-break: break-all; }`,
      `<body><div id="box">Supercalifragilisticexpialidocious</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(wrapOf(result)).toBe("character");
  });

  it("overflow-wrap: break-word maps to wrap: word-break-long", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; overflow-wrap: break-word; }`,
      `<body><div id="box">Hi there Supercalifragilisticexpialidocious end</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(wrapOf(result)).toBe("word-break-long");
  });

  it("word-wrap: break-word (the legacy alias) has the same effect as overflow-wrap", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; word-wrap: break-word; }`,
      `<body><div id="box">Hi there Supercalifragilisticexpialidocious end</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(wrapOf(result)).toBe("word-break-long");
  });

  it("word-break: break-all wins when both it and overflow-wrap: break-word are set", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; word-break: break-all; overflow-wrap: break-word; }`,
      `<body><div id="box">Hi there Supercalifragilisticexpialidocious end</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(wrapOf(result)).toBe("character");
  });

  it("defaults to plain word wrap when neither is set", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; }`,
      `<body><div id="box">Hi there Supercalifragilisticexpialidocious end</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(wrapOf(result)).toBe("word");
  });

  it("white-space: nowrap disables wrapping outright, overriding word-break: break-all", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; white-space: nowrap; word-break: break-all; }`,
      `<body><div id="box">Hi there Supercalifragilisticexpialidocious end</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(wrapOf(result)).toBe("none");
  });

  it("inherits from an ancestor, like real CSS word-break", () => {
    const result = compile(
      `#parent { word-break: break-all; } #box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; }`,
      `<body><div id="parent"><div id="box">Supercalifragilisticexpialidocious</div></div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(wrapOf(result)).toBe("character");
  });

  it("rejects word-break: keep-all instead of silently ignoring it", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; word-break: keep-all; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-word-break-unsupported");
  });

  it("rejects overflow-wrap: anywhere instead of silently treating it like break-word", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 150px; font-family: Inter; font-size: 20px; overflow-wrap: anywhere; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-overflow-wrap-unsupported");
  });
});
