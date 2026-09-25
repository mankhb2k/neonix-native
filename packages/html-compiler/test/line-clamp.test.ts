import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

const FONT_ASSET = { id: "inter-regular", kind: "font" as const, uri: "/fonts/inter.ttf", weight: 400, style: "normal" as const, integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", family: "Inter" };

function compile(css: string, body: string) {
  return compileHtmlCss(createHtmlCssSource({ html: body, css }), { fontAssets: [FONT_ASSET] });
}

function textLayer(result: ReturnType<typeof compile>) {
  return result.protocol?.layers.find((layer) => layer.type === "text");
}

// `-webkit-line-clamp` was not in SUPPORTED_PROPERTIES at all - every use
// hard-failed with "Phase 2 does not support -webkit-line-clamp", even
// though it's the standard way to truncate a multi-line caption/description
// to N lines with an ellipsis (very common in motion-graphics lower thirds).
// Most of the runtime machinery (maxLines>1 clamping, ellipsizing the last
// line) already existed for the single-line text-overflow:ellipsis case;
// this only needed html-compiler to route line-clamp into that same path
// with wrap:"word" instead of the nowrap single-line case.
describe("-webkit-line-clamp", () => {
  it("caps a long paragraph's intrinsic auto-height to exactly N lines", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; line-height: 24px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }`,
      `<body><div id="box">This is a long paragraph of text that should wrap across several lines and then get clamped to exactly three lines with an ellipsis at the end instead of overflowing further down the page.</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const layer = textLayer(result);
    expect(layer?.payload.layout).toMatchObject({ wrap: "word", textOverflow: "ellipsis", maxLines: 3 });
    expect(layer?.frame.height).toBeCloseTo(3 * 24, 5);
  });

  it("does not stretch short text up to the clamp height - the cap is a maximum, not a fixed size", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; line-height: 24px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }`,
      `<body><div id="box">Short text.</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(textLayer(result)?.frame.height).toBeCloseTo(24, 5);
  });

  it("has no effect without box-orient: vertical, matching the legacy -webkit-box spec", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; line-height: 24px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: horizontal; overflow: hidden; }`,
      `<body><div id="box">This is a long paragraph of text that should NOT be clamped because box-orient is horizontal here, not vertical.</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const layer = textLayer(result);
    expect(layer?.payload.layout.textOverflow).toBe("clip");
    expect(layer?.payload.layout.maxLines).toBeUndefined();
    // Natural unclamped wrap height for this text at this width/font.
    expect(layer?.frame.height).toBeGreaterThan(24 * 3);
  });

  it("still requires overflow: hidden, same as single-line text-overflow: ellipsis", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; line-height: 24px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }`,
      `<body><div id="box">Some text long enough to wrap across multiple lines for this test case.</div></body>`,
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-text-overflow-requires-clipping");
  });

  it("keeps an author-supplied explicit height as-is, only applying maxLines for truncation", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; height: 200px; font-family: Inter; font-size: 20px; line-height: 24px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`,
      `<body><div id="box">This is a long paragraph of text that should wrap across several lines and then get clamped.</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    const layer = textLayer(result);
    expect(layer?.frame.height).toBe(200);
    expect(layer?.payload.layout.maxLines).toBe(2);
  });

  it("rejects a non-integer -webkit-line-clamp value instead of silently ignoring it", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; display: -webkit-box; -webkit-line-clamp: two; -webkit-box-orient: vertical; overflow: hidden; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-line-clamp-unsupported");
  });

  it("accepts display: -webkit-box for layout purposes (behaves like block)", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; display: -webkit-box; -webkit-box-orient: vertical; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
  });
});
