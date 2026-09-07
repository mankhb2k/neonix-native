import { describe, expect, it } from "vitest";
import { compileHtmlCss } from "..";
import { calcExpression } from "../compiler/values";

describe("CSS value primitives", () => {
  it("resolves small, large, dynamic viewport and container units", () => {
    const viewport = {
      width: 1200,
      height: 800,
      smallWidth: 1000,
      smallHeight: 700,
      largeWidth: 1400,
      largeHeight: 900,
      dynamicWidth: 1100,
      dynamicHeight: 750,
      containerWidth: 400,
      containerHeight: 240,
    };
    expect(calcExpression("10svw", "width", 0, 16, 16, viewport).value).toBe(100);
    expect(calcExpression("10lvh", "height", 0, 16, 16, viewport).value).toBe(90);
    expect(calcExpression("10dvw + 10cqw", "width", 0, 16, 16, viewport).value).toBe(150);
    expect(calcExpression("50cqmin", "width", 0, 16, 16, viewport).value).toBe(120);
  });

  it("evaluates trig, power and rounding functions inside calc", () => {
    expect(calcExpression("sin(90deg)", "opacity", 0, 16, 16, { width: 1920, height: 1080 }).value).toBeCloseTo(1);
    expect(calcExpression("pow(2, 3) + sqrt(16)", "opacity", 0, 16, 16, { width: 1920, height: 1080 }).value).toBe(12);
    expect(calcExpression("round(down, 27px, 10px)", "width", 0, 16, 16, { width: 1920, height: 1080 }).value).toBe(20);
    expect(calcExpression("mod(-5px, 3px)", "width", 0, 16, 16, { width: 1920, height: 1080 }).value).toBe(1);
  });

  it("uses the current containing block for container units during layout", () => {
    const result = compileHtmlCss({
      html: `<div id="root"><div id="box"></div></div>`,
      css: `#root { position: absolute; left: 0; top: 0; width: 400px; height: 240px; } #box { width: 50cqw; height: 50cqh; }`,
    });
    expect(result.status).toBe("success");
    const box = result.protocol?.layers.find((layer) => layer.id === "box");
    expect(box?.frame).toEqual({ width: 200, height: 120 });
  });

  it("reports element() instead of silently dropping a live snapshot", () => {
    const result = compileHtmlCss({
      html: `<div id="box"></div>`,
      css: `#box { width: 100px; height: 100px; background-image: element(#source); }`,
    });
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("css-background-image-element-unsupported");
  });
});
