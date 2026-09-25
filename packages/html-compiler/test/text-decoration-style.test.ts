import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

const FONT_ASSET = { id: "inter-regular", kind: "font" as const, uri: "/fonts/inter.ttf", weight: 400, style: "normal" as const, integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", family: "Inter" };

function compile(css: string, body: string) {
  return compileHtmlCss(createHtmlCssSource({ html: body, css }), { fontAssets: [FONT_ASSET] });
}

function decorationOf(result: ReturnType<typeof compile>) {
  return result.protocol?.layers.find((layer) => layer.type === "text")?.payload.chunks[0]?.spans[0]?.textDecoration;
}

// `text-decoration: underline wavy/dotted/dashed` previously hard-rejected
// every non-solid style token. Only `double` remains unsupported (it needs
// two parallel lines, different geometry entirely, not just a different
// stroke pattern on the same centerline).
describe("text-decoration-style", () => {
  it("accepts wavy and records it on the underline style", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-decoration: underline wavy #ff0000; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(decorationOf(result)).toMatchObject({ underline: { fill: "#ff0000", style: "wavy" } });
  });

  it("accepts dotted", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-decoration: underline dotted; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(decorationOf(result)).toMatchObject({ underline: { style: "dotted" } });
  });

  it("accepts dashed together with an explicit thickness", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-decoration: line-through dashed 3px; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(decorationOf(result)).toMatchObject({ lineThrough: { style: "dashed", strokeWidth: { value: 3, unit: "px" } } });
  });

  it("omits the style field for an explicit solid (matches the default, no need to carry it downstream)", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-decoration: underline solid; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(decorationOf(result)?.underline?.style).toBeUndefined();
  });

  it("omits the style field when no style token is authored at all", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-decoration: underline; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(decorationOf(result)?.underline?.style).toBeUndefined();
  });

  it("still rejects double instead of silently approximating it", () => {
    const result = compile(
      `#box { position: absolute; left: 0; top: 0; width: 300px; font-family: Inter; font-size: 20px; text-decoration: underline double; }`,
      `<body><div id="box">Text</div></body>`,
    );
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-text-decoration-style-unsupported");
  });
});
