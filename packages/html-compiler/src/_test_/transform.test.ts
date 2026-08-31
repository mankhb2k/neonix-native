import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

function compileTransform(transform: string, origin?: string) {
  const result = compileHtmlCss(createHtmlCssSource({
    html: `<div id="transform"></div>`,
    css: `#transform { position: absolute; left: 100px; top: 80px; width: 400px; height: 200px; background: #14b8a6; transform: ${transform};${origin ? ` transform-origin: ${origin};` : ""} }`,
  }));
  expect(result.status).toBe("success");
  return result.protocol?.layers[0];
}

describe("HTML/CSS compiler transforms", () => {
  it("lowers translate and translateX/Y to numeric Protocol values", () => {
    const layer = compileTransform("translate(24px, 16px)");
    expect(layer?.transform.translate).toMatchObject({ x: 124, y: 96, z: 0 });
    expect(layer?.transform.operations).toEqual([{ type: "translate", value: { x: 24, y: 16, z: 0 } }]);
  });

  it("uses CSS transform-origin as a local anchor for scale", () => {
    const layer = compileTransform("scale(1.5, 0.75)", "25% 75%");
    expect(layer?.transform.scale).toMatchObject({ x: 1.5, y: 0.75, z: 1 });
    expect(layer?.transform.anchor).toMatchObject({ x: 100, y: 150, z: 0 });
  });

  it("normalizes rotate units and keeps ordered operations", () => {
    const layer = compileTransform("translateX(10px) rotate(0.25turn) skewX(12deg)");
    expect(layer?.transform.rotate.z).toBe(90);
    expect(layer?.transform.translate.x).toBe(110);
    expect(layer?.transform.operations).toHaveLength(3);
    expect(layer?.transform.operations?.map((operation) => operation.type)).toEqual(["translate", "rotateZ", "skew"]);
  });
});
