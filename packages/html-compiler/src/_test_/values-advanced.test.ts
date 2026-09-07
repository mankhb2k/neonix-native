import { describe, expect, it } from "vitest";
import { compileHtmlCss } from "..";
import { calcExpression } from "../compiler/values";

describe("CSS value primitives", () => {
  it("rejects removed viewport, container and responsive properties", () => {
    for (const css of [
      "#box { width: 10dvw; height: 10px; }",
      "#box { width: 10cqw; height: 10px; }",
      "#box { width: 10px; height: 10px; container-type: size; }",
    ]) {
      const result = compileHtmlCss({ html: `<div id="box"></div>`, css });
      expect(result.status).toBe("error");
      expect(result.diagnostics[0]?.code).toMatch(/css-(property-unsupported|value-invalid)/);
    }
  });

  it("evaluates trig, power and rounding functions inside calc", () => {
    expect(calcExpression("sin(90deg)", "opacity", 0, 16, 16, { width: 1920, height: 1080 }).value).toBeCloseTo(1);
    expect(calcExpression("pow(2, 3) + sqrt(16)", "opacity", 0, 16, 16, { width: 1920, height: 1080 }).value).toBe(12);
    expect(calcExpression("round(down, 27px, 10px)", "width", 0, 16, 16, { width: 1920, height: 1080 }).value).toBe(20);
    expect(calcExpression("mod(-5px, 3px)", "width", 0, 16, 16, { width: 1920, height: 1080 }).value).toBe(1);
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
