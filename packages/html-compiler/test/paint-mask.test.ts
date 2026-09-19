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

  it("resolves advanced mask compositing in authored layer order", () => {
    const protocol = compile("mask-image: linear-gradient(90deg, #fff, #000), radial-gradient(circle, #fff, #000), linear-gradient(#fff, #000); mask-mode: alpha, luminance, alpha; mask-position: left top, center center, right bottom; mask-size: 300px 120px, 200px 100px, 100px 80px; mask-repeat: no-repeat, no-repeat, no-repeat; mask-composite: subtract, exclude;");
    const layer = protocol.layers.find((candidate) => candidate.id === "masked");
    expect(layer?.maskLayers).toEqual([
      { maskIds: ["masked-mask-0"], mode: "alpha", composite: "add" },
      { maskIds: ["masked-mask-1"], mode: "luminance", composite: "subtract" },
      { maskIds: ["masked-mask-2"], mode: "alpha", composite: "exclude" },
    ]);
    expect(protocol.masks?.map((mask) => mask.image?.x ?? mask.children?.[0]?.x)).toEqual([0, 260, 620]);
  });

  it("lowers image() and cross-fade() without inventing paint source names", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="images"></div>`,
      css: `#images { position: absolute; width: 320px; height: 180px; background-image: image(url(/a.png)), cross-fade(25%, url(/a.png), url(/b.png)); background-size: 320px 180px, 320px 180px; background-repeat: no-repeat, no-repeat; }`,
    }));
    expect(result.status).toBe("success");
    const imageLayers = result.protocol?.layers.filter((layer) => layer.type === "image");
    expect(imageLayers).toHaveLength(3);
    expect(imageLayers?.map((layer) => layer.opacity)).toEqual([1, 0.75, 0.25]);
  });

  it("selects a supported image() gradient before a color fallback", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="images"></div>`,
      css: `#images { position: absolute; width: 320px; height: 180px; background-image: image(unsupported-source, linear-gradient(90deg, #ff0000, #0000ff), #00ff00); background-repeat: no-repeat; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers).toContainEqual(expect.objectContaining({
      id: "images::background:0",
      type: "shape",
      style: { fill: expect.objectContaining({ type: "linear-gradient" }) },
    }));
  });

  it("uses image() color fallback when no image source is supported", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="images"></div>`,
      css: `#images { position: absolute; width: 320px; height: 180px; background-image: image(unsupported-source, rgba(255, 0, 0, 50%)); background-repeat: no-repeat; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers).toContainEqual(expect.objectContaining({
      id: "images::background:0",
      type: "shape",
      style: { fill: "#ff000080" },
    }));
  });

  it("accepts the percentage at the end of cross-fade()", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="images"></div>`,
      css: `#images { position: absolute; width: 320px; height: 180px; background-image: cross-fade(url(/a.png), url(/b.png), 25%); background-size: 320px 180px; background-repeat: no-repeat; }`,
    }));
    expect(result.status).toBe("success");
    expect(result.protocol?.layers.filter((layer) => layer.type === "image").map((layer) => layer.opacity)).toEqual([0.75, 0.25]);
  });
});
