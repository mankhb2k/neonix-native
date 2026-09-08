import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

function compile(css: string) {
  const result = compileHtmlCss(createHtmlCssSource({
    html: `<div id="masked"></div>`,
    css: `#masked { position: absolute; left: 120px; top: 120px; width: 720px; height: 420px; background: #2563eb; ${css} }`,
  }));
  expect(result.status).toBe("success");
  return result.protocol!;
}

describe("HTML/CSS compiler P2.8 CSS masks", () => {
  it("lowers an alpha gradient into a mask definition and layer reference", () => {
    const protocol = compile("mask-image: linear-gradient(90deg, #00000000 0%, #000000ff 100%); mask-mode: alpha; mask-repeat: no-repeat;");
    expect(protocol.masks).toHaveLength(1);
    expect(protocol.masks?.[0]).toMatchObject({ maskType: "alpha", children: [{ type: "rect", fill: { type: "linear-gradient" } }] });
    expect(protocol.layers.find((layer) => layer.id === "masked")).toMatchObject({ maskLayers: [{ maskIds: ["masked-mask-0"], mode: "alpha", composite: "add" }] });
  });

  it("keeps mask asset metadata and deterministic viewport geometry", () => {
    const protocol = compile("mask-image: url(/preview/image/img-alpha.png); mask-mode: luminance; mask-position: center; mask-size: 320px 180px; mask-repeat: no-repeat;");
    expect(protocol.masks?.[0]).toMatchObject({ maskType: "luminance", image: { type: "image", assetId: "masked-mask-0-0-asset", x: 200, y: 120, width: 320, height: 180, fit: "fill" } });
    expect(protocol.assets).toContainEqual(expect.objectContaining({ id: "masked-mask-0-0-asset", uri: "/preview/image/img-alpha.png" }));
  });

  it("preserves two CSS mask layers and their composite operators", () => {
    const protocol = compile("mask-image: linear-gradient(90deg, #ffffff 0%, #000000 100%), radial-gradient(circle, #ffffff 0%, #000000 100%); mask-mode: alpha, luminance; mask-composite: intersect; mask-repeat: no-repeat, no-repeat;");
    expect(protocol.layers.find((layer) => layer.id === "masked")).toMatchObject({
      maskLayers: [
        { maskIds: ["masked-mask-0"], mode: "alpha", composite: "add" },
        { maskIds: ["masked-mask-1"], mode: "luminance", composite: "intersect" },
      ],
    });
  });
});
