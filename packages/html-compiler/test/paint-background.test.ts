import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

describe("HTML/CSS compiler P2.0 background images", () => {
  it("clips solid backgrounds to background-clip and keeps the border inside the border box", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="card"></div>`,
      css: `#card { position: absolute; left: 100px; top: 80px; width: 960px; height: 480px; box-sizing: border-box; padding: 48px; border: 20px solid #38bdf8; background-color: #172554; background-clip: content-box; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.layers.find((layer) => layer.id === "card")).toMatchObject({ type: "group", frame: { width: 960, height: 480 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "card::paint")).toMatchObject({
      frame: { width: 824, height: 344 },
      transform: { translate: { x: 68, y: 68 } },
      style: { fill: "#172554" },
    });
    expect(result.protocol?.layers.find((layer) => layer.id === "card::border")).toMatchObject({
      frame: { width: 940, height: 460 },
      transform: { translate: { x: 10, y: 10 } },
      style: { fill: "#00000000", stroke: "#38bdf8", strokeWidth: 20 },
    });
  });

  it("lowers a positioned cover URL to an image atomic and clips it to the owner", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="card"></div>`,
      css: `body { margin: 0; } #card { position: absolute; left: 200px; top: 120px; width: 800px; height: 400px; background-color: #172554; background-image: url("/preview/image/photo-landscape.jpg"); background-position: center; background-size: cover; background-repeat: no-repeat; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.assets).toEqual([
      { id: "card-background-0-0-asset", kind: "image", uri: "/preview/image/photo-landscape.jpg", mimeType: "image/jpeg" },
    ]);
    expect(result.protocol?.layers.find((layer) => layer.id === "card")).toMatchObject({ type: "group", frame: { width: 800, height: 400 } });
    expect(result.protocol?.layers.find((layer) => layer.id === "card::background:0")).toMatchObject({
      type: "image",
      parentLayerId: "card",
      frame: { width: 800, height: 400 },
      payload: { fit: "cover", preserveAspectRatio: { align: "xMidYMid", meetOrSlice: "slice" } },
    });
    expect(result.protocol?.clipPaths?.[0]).toMatchObject({
      clipPathUnits: "userSpaceOnUse",
      children: [{ x: 0, y: 0, width: 800, height: 400 }],
    });
  });

  it("lowers explicit background repeat into bounded image tiles", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="tile"></div>`,
      css: `#tile { position: absolute; width: 640px; height: 360px; background-image: url(/preview/image/img-alpha.png); background-size: 160px 120px; background-repeat: repeat; }`,
    }));

    expect(result.status).toBe("success");
    const imageLayers = result.protocol?.layers.filter((layer) => layer.type === "image") ?? [];
    expect(imageLayers.length).toBeGreaterThan(12);
    expect(imageLayers.every((layer) => layer.parentLayerId === "tile")).toBe(true);
    expect(result.protocol?.clipPaths?.length).toBe(imageLayers.length);
  });

  it("keeps multiple background URL layers in authored paint order", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="layers"></div>`,
      css: `#layers { position: absolute; width: 640px; height: 360px; background-image: url(/preview/image/photo-landscape.jpg), url(/preview/image/img-alpha.png); background-position: center, right bottom; background-size: cover, 160px 120px; background-repeat: no-repeat, no-repeat; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.protocol?.assets?.map((asset) => asset.id)).toEqual([
      "layers-background-0-0-asset",
      "layers-background-1-0-asset",
    ]);
    const first = result.protocol?.layers.find((layer) => layer.id === "layers::background:0");
    const second = result.protocol?.layers.find((layer) => layer.id === "layers::background:1");
    expect(first?.order).toBeGreaterThan(second?.order ?? -1);
  });

  it("lowers repeated gradient backgrounds into fixed-size aligned tiles", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="grid"></div>`,
      css: `#grid { position: absolute; left: 480px; top: 300px; width: 960px; height: 480px; background-image: repeating-linear-gradient(90deg, #38bdf8 0%, #38bdf8 1%, transparent 1%, transparent 100%), repeating-linear-gradient(0deg, #38bdf8 0%, #38bdf8 1%, transparent 1%, transparent 100%); background-size: 120px 120px, 120px 120px; background-repeat: repeat, repeat; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.diagnostics).toEqual([]);
    const tiles = result.protocol?.layers.filter((layer) => layer.id.startsWith("grid::background:")) ?? [];
    expect(tiles.length).toBeGreaterThan(100);
    expect(tiles.every((layer) => layer.type === "shape" && layer.frame.width === 120 && layer.frame.height === 120)).toBe(true);
    expect(tiles.every((layer) => layer.style.fill && typeof layer.style.fill === "object" && layer.style.fill.type === "linear-gradient")).toBe(true);
  });

  it.each([
    ["radial-gradient(circle at 50% 50%, #38bdf8 0%, transparent 100%)", "radial-gradient"],
    ["conic-gradient(from 45deg at 50% 50%, #38bdf8 0%, #7c3aed 33.333%, #f97316 66.666%, #38bdf8 100%)", "conic-gradient"],
  ] as const)("repeats a non-linear %s background without changing its paint type", (gradient, paintType) => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="tile"></div>`,
      css: `#tile { position: absolute; width: 480px; height: 360px; background: ${gradient}; background-size: 120px 120px; background-repeat: repeat; }`,
    }));

    expect(result.status).toBe("success");
    expect(result.diagnostics).toEqual([]);
    const tiles = result.protocol?.layers.filter((layer) => layer.id.includes("::tile:")) ?? [];
    expect(tiles.length).toBe(12);
    expect(tiles.every((layer) => layer.type === "shape" && layer.frame.width === 120 && layer.frame.height === 120)).toBe(true);
    expect(tiles.every((layer) => layer.type === "shape" && typeof layer.style.fill === "object" && layer.style.fill.type === paintType)).toBe(true);
    expect(result.protocol?.clipPaths?.length).toBe(tiles.length);
  });

  it("resolves a repeated radial circle against the background tile, not the owner box", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="radial"></div>`,
      css: `#radial { position: absolute; width: 1440px; height: 480px; background: radial-gradient(circle at 50% 50%, #38bdf8 0%, #0e7490 18%, transparent 19%, transparent 100%); background-size: 120px 120px; background-repeat: repeat; }`,
    }));

    expect(result.status).toBe("success");
    const tile = result.protocol?.layers.find((layer) => layer.id === "radial::paint::tile:0");
    expect(tile).toMatchObject({
      type: "shape",
      frame: { width: 120, height: 120 },
      style: { fill: { type: "radial-gradient", cx: 0.5, cy: 0.5, radius: expect.closeTo(Math.SQRT1_2, 6) } },
    });
  });

  it.each([
    ["repeat", { minX: 2, minY: 2 }],
    ["repeat-x", { minX: 2, minY: 1 }],
    ["repeat-y", { minX: 1, minY: 2 }],
    ["no-repeat", { minX: 1, minY: 1 }],
  ] as const)("preserves shorthand gradient %s tiling without repeatX/repeatY fields", (repeat, expected) => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="tile"></div>`,
      css: `#tile { position: absolute; width: 640px; height: 360px; background: linear-gradient(90deg, #38bdf8 0%, #38bdf8 4%, transparent 4%, transparent 100%); background-size: 160px 120px; background-repeat: ${repeat}; }`,
    }));

    expect(result.status).toBe("success");
    const pattern = result.protocol?.layers.find((layer) => layer.type === "shape" && typeof layer.style.fill === "object" && layer.style.fill.type === "pattern")?.style.fill;
    const tiles = result.protocol?.layers.filter((layer) => layer.id.startsWith("tile::paint::tile:")) ?? [];
    const positions = tiles.map((layer) => layer.transform.translate);
    if (repeat === "repeat") {
      expect(pattern && typeof pattern === "object" && pattern.type === "pattern").toBe(true);
      expect(pattern && typeof pattern === "object" && pattern.type === "pattern" && pattern.width).toBe(160);
      expect(pattern && typeof pattern === "object" && pattern.type === "pattern" && pattern.height).toBe(120);
      return;
    }
    const xPositions = new Set(positions.map((position) => position.x));
    const yPositions = new Set(positions.map((position) => position.y));
    expect(tiles.length).toBeGreaterThanOrEqual(expected.minX * expected.minY);
    expect(xPositions.size).toBeGreaterThanOrEqual(expected.minX);
    expect(yPositions.size).toBeGreaterThanOrEqual(expected.minY);
    expect(tiles.every((layer) => layer.type === "shape" && layer.frame.width === 160 && layer.frame.height === 120)).toBe(true);
    if (repeat === "no-repeat") expect(tiles).toHaveLength(1);
    if (repeat === "repeat-x") expect(yPositions.size).toBe(1);
    if (repeat === "repeat-y") expect(xPositions.size).toBe(1);
  });

  it("keeps a shorthand multi-layer grid in owner rectangles with local pattern tiles", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="grid"></div>`,
      css: `#grid { position: absolute; left: 120px; top: 120px; width: 1680px; height: 840px; background: repeating-linear-gradient(0deg, #284457 0%, #284457 0.0833%, transparent 0.0833%, transparent 8.3333%), repeating-linear-gradient(90deg, #284457 0%, #284457 0.0833%, transparent 0.0833%, transparent 8.3333%); background-size: 120px 120px, 120px 120px; background-repeat: repeat, repeat; }`,
    }));

    expect(result.status).toBe("success");
    const paints = result.protocol?.layers.filter((layer) => layer.id.startsWith("grid::paint:")) ?? [];
    expect(paints).toHaveLength(2);
    expect(result.protocol?.clipPaths ?? []).toHaveLength(0);
    expect(new Set(paints.map((layer) => layer.order)).size).toBe(paints.length);
    expect(paints.every((layer) => layer.type === "shape" && layer.frame.width === 1680 && layer.frame.height === 840)).toBe(true);
    const patterns = paints.flatMap((layer) => layer.type === "shape" && typeof layer.style.fill === "object" && layer.style.fill.type === "pattern" ? [layer.style.fill] : []);
    expect(patterns).toHaveLength(2);
    expect(patterns.every((pattern) => pattern.width === 120 && pattern.height === 120 && pattern.content.length === 1)).toBe(true);
    expect(patterns.every((pattern) => pattern.content[0]?.type === "rect" && pattern.content[0].width === 120 && pattern.content[0].height === 120 && typeof pattern.content[0].fill === "object" && pattern.content[0].fill.type === "linear-gradient")).toBe(true);
  });
});
