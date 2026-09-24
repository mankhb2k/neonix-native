import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "..";
import { parseBorderEdges, parseOutline, parseShadows } from "../src/compiler/paint";
import { parseFilter } from "../src/compiler/filter";

const viewport = { width: 1920, height: 1080 };

// isPaintToken() only recognized hex colors and a few keywords, so
// rgba(...)/hsl(...) etc. were misclassified as length/style/width tokens by
// every shorthand tokenizer that uses it to find "the color" among several
// space-separated values — producing a confusing "invalid length" error
// instead of parsing the color. box-shadow, text-shadow, filter:
// drop-shadow(), border and outline all share this tokenizer.
describe("color-function tokens in shorthand properties", () => {
  it("recognizes rgba() as the color in box-shadow, not a length", () => {
    const shadows = parseShadows(
      new Map([["box-shadow", "0 20px 60px rgba(0,0,0,0.4)"]]),
      "box-shadow",
      1920,
      16,
      viewport,
      "#000000",
    );
    expect(shadows).toEqual([
      { id: "box-shadow:0", type: "shadow", source: "box", offset: { x: 0, y: 20 }, blur: 60, spread: 0, inset: false, color: "#00000066" },
    ]);
  });

  it("recognizes rgba() as the color in text-shadow", () => {
    const shadows = parseShadows(
      new Map([["text-shadow", "4px 6px 8px rgba(56,189,248,0.6)"]]),
      "text-shadow",
      1920,
      16,
      viewport,
      "#000000",
    );
    expect(shadows[0]).toMatchObject({ offset: { x: 4, y: 6 }, blur: 8, color: "#38bdf899" });
  });

  it("recognizes rgba() as the color in filter: drop-shadow()", () => {
    const effects = parseFilter("drop-shadow(8px 10px 12px rgba(0,0,0,0.6))", 1920, 16, viewport, "#000000");
    expect(effects).toEqual([
      { id: "filter:0", type: "shadow", source: "alpha", offset: { x: 8, y: 10 }, blur: 12, spread: 0, inset: false, color: "#00000099" },
    ]);
  });

  it("recognizes rgba() as the color in the border shorthand", () => {
    const edges = parseBorderEdges(new Map([["border", "2px solid rgba(0,0,0,0.3)"]]), 1920, 16, viewport);
    expect(edges.top).toMatchObject({ width: 2, style: "solid", color: "#0000004d" });
  });

  it("recognizes rgba() as the color in the outline shorthand", () => {
    const outline = parseOutline(new Map([["outline", "3px solid rgba(255,255,255,0.5)"]]), 1920, 16, viewport);
    expect(outline).toMatchObject({ width: 3, style: "solid", color: "#ffffff80" });
  });

  it("compiles a full document using rgba() box-shadow end to end", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="card"></div>`,
      css: "#card { position: absolute; left: 100px; top: 100px; width: 300px; height: 200px; background: #2563eb; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }",
    }));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "card")).toMatchObject({
      effects: [{ type: "shadow", offset: { x: 0, y: 20 }, blur: 60, color: "#00000066" }],
    });
  });
});
