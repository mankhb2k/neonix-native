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
    expect(layer?.transform.translate).toMatchObject({ x: 100, y: 80, z: 0 });
    expect(layer?.transform.operations).toEqual([
      { type: "translate", x: 24, y: 16 },
    ]);
  });

  it("uses CSS transform-origin as a local anchor for scale", () => {
    const layer = compileTransform("scale(1.5, 0.75)", "25% 75%");
    expect(layer?.transform.scale).toMatchObject({ x: 1.5, y: 0.75, z: 1 });
    expect(layer?.transform.anchor).toMatchObject({ x: 100, y: 150, z: 0 });
    expect(layer?.transform.extensions).toEqual({ anchor: { x: 100, y: 150, z: 0 } });
  });

  it("normalizes rotate units and keeps ordered operations", () => {
    const layer = compileTransform("translateX(10px) rotate(0.25turn) skewX(12deg)");
    expect(layer?.transform.rotate.z).toBe(90);
    expect(layer?.transform.translate.x).toBe(100);
    expect(layer?.transform.operations).toHaveLength(3);
    expect(layer?.transform.operations?.map((operation) => operation.type)).toEqual(["translate", "rotate", "skewX"]);
  });

  it("lowers the remaining transform function spellings", () => {
    const layer = compileTransform("translateY(12px) scaleX(1.25) scaleY(0.8) rotateZ(15deg) skew(8deg, 4deg)");
    expect(layer?.transform.translate).toMatchObject({ x: 100, y: 80, z: 0 });
    expect(layer?.transform.scale).toMatchObject({ x: 1.25, y: 0.8, z: 1 });
    expect(layer?.transform.rotate).toMatchObject({ x: 0, y: 0, z: 15 });
    expect(layer?.transform.skew).toMatchObject({ x: 8, y: 4 });
    expect(layer?.transform.operations?.map((operation) => operation.type)).toEqual([
      "translate",
      "scale",
      "scale",
      "extension",
      "skewX",
      "skewY",
    ]);
  });

  it("lowers CSS matrix() as an ordered affine operation", () => {
    const layer = compileTransform("matrix(1.2, 0.25, -0.1, 0.8, 24, 16)");
    expect(layer?.transform.operations).toEqual([
      { type: "matrix", values: [1.2, 0.25, -0.1, 0.8, 24, 16] },
    ]);
  });

  it("lowers CSS matrix3d() to the canonical column-major Matrix4 extension", () => {
    const values = [1, 0.1, 0, 0, 0.2, 1, 0, 0, 0, 0, 1, -0.001, 40, 20, 80, 1];
    const layer = compileTransform(`matrix3d(${values.join(", ")})`);
    expect(layer?.transform.operations).toEqual([
      { type: "extension", name: "motion.matrix4", value: values },
    ]);
  });
});
