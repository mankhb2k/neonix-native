import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

const FONT_ASSET = { id: "inter-regular", kind: "font" as const, uri: "/fonts/inter.ttf", weight: 400, style: "normal" as const, integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", family: "Inter" };

function compile(css: string, body: string) {
  return compileHtmlCss(createHtmlCssSource({ html: body, css }), { fontAssets: [FONT_ASSET] });
}

function spansOf(result: ReturnType<typeof compile>) {
  return result.protocol?.layers.find((layer) => layer.type === "text")?.payload.chunks[0]?.spans;
}

// `vertical-align` was not in SUPPORTED_PROPERTIES at all. It's resolved
// per inline span (through Protocol V2's SVG-style baseline-shift field),
// not once for the whole text box, so `<sup>`/`<sub>`-style badges inside a
// sentence shift only their own run - the runtime side of this (per-span
// glyph.y, not just the whole line) has its own real-HarfBuzz test in
// motion-runtime's text-layout.test.ts.
describe("vertical-align", () => {
  it("maps sub/super to the subscript/superscript baseline-shift keywords, per span", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; }
       #sup { vertical-align: super; } #sub { vertical-align: sub; }`,
      `<body><div id="box">Normal<span id="sup">sup</span>text<span id="sub">sub</span>end</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const spans = spansOf(result)!;
    expect(spans).toHaveLength(5);
    expect(spans[0]!.baselineShift).toBeUndefined();
    expect(spans[1]!.baselineShift).toBe("superscript");
    expect(spans[2]!.baselineShift).toBeUndefined();
    expect(spans[3]!.baselineShift).toBe("subscript");
    expect(spans[4]!.baselineShift).toBeUndefined();
  });

  it("resolves a length, negated so a positive CSS length (raises the box) matches the numeric baseline-shift channel's own sign convention", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; }
       #raised { vertical-align: 5px; }`,
      `<body><div id="box">Normal<span id="raised">raised</span></div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(spansOf(result)![1]!.baselineShift).toEqual({ value: -5, unit: "px" });
  });

  it("resolves an em length relative to the span's own font-size", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; }
       #lowered { vertical-align: -0.5em; }`,
      `<body><div id="box">Normal<span id="lowered">lowered</span></div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(spansOf(result)![1]!.baselineShift).toEqual({ value: 10, unit: "px" });
  });

  it("leaves baselineShift unset at the default (baseline)", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; }`,
      `<body><div id="box">Normal text</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(spansOf(result)![0]!.baselineShift).toBeUndefined();
  });

  it("rejects line-box-relative keywords (top/bottom/middle/text-top/text-bottom) instead of rendering at the wrong position", () => {
    for (const value of ["top", "bottom", "middle", "text-top", "text-bottom"]) {
      const result = compile(
        `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; }
         #mid { vertical-align: ${value}; }`,
        `<body><div id="box"><span id="mid">Text</span></div></body>`,
      );
      expect(result.status, `${value} should fail`).toBe("error");
      expect(result.diagnostics[0]?.code).toBe("css-vertical-align-unsupported");
    }
  });

  it("does not inherit, matching real CSS vertical-align", () => {
    const result = compile(
      `#parent { vertical-align: super; } #box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; }`,
      `<body><div id="parent"><div id="box">Text</div></div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(spansOf(result)![0]!.baselineShift).toBeUndefined();
  });
});
