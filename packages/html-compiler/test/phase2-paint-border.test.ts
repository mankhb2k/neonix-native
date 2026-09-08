import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "..";
import { parseBorderEdges, parseCornerRadii } from "../src/compiler/paint";

const viewport = { width: 1920, height: 1080 };

describe("HTML/CSS compiler P2.2 borders", () => {
  it("resolves each border side independently", () => {
    const edges = parseBorderEdges(new Map([
      ["border-top", "12px solid #38bdf8"],
      ["border-right", "8px dashed #a78bfa"],
      ["border-bottom", "4px dotted #facc15"],
      ["border-left", "2px double #fb7185"],
    ]), 720, 16, viewport);
    expect(edges).toMatchObject({
      top: { width: 12, style: "solid", color: "#38bdf8" },
      right: { width: 8, style: "dashed", color: "#a78bfa" },
      bottom: { width: 4, style: "dotted", color: "#facc15" },
      left: { width: 2, style: "double", color: "#fb7185" },
    });
  });

  it("accepts deterministic 3D border styles in shorthand and longhands", () => {
    const edges = parseBorderEdges(new Map([
      ["border", "12px groove #38bdf8"],
      ["border-right-style", "ridge"],
      ["border-bottom", "12px inset #38bdf8"],
      ["border-left-style", "outset"],
    ]), 720, 16, viewport);
    expect(edges).toMatchObject({
      top: { width: 12, style: "groove", color: "#38bdf8" },
      right: { width: 12, style: "ridge", color: "#38bdf8" },
      bottom: { width: 12, style: "inset", color: "#38bdf8" },
      left: { width: 12, style: "outset", color: "#38bdf8" },
    });
  });

  it("clamps per-corner and elliptical radii using adjacent sums", () => {
    expect(parseCornerRadii(new Map([["border-radius", "80px 40px 80px 40px"]]), 100, 60, 16, viewport)).toEqual({
      topLeft: { rx: 40, ry: 40 }, topRight: { rx: 20, ry: 20 }, bottomRight: { rx: 40, ry: 40 }, bottomLeft: { rx: 20, ry: 20 },
    });
    expect(parseCornerRadii(new Map([["border-radius", "80px 40px / 20px 60px"]]), 100, 60, 16, viewport)).toEqual({
      topLeft: { rx: 60, ry: 15 }, topRight: { rx: 30, ry: 45 }, bottomRight: { rx: 60, ry: 15 }, bottomLeft: { rx: 30, ry: 45 },
    });
  });

  it("lowers complex border styles to stable side path passes", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="box"></div>`,
      css: `#box { width: 240px; height: 120px; background: #172554; border-top: 8px dashed #38bdf8; border-right: 12px dotted #a78bfa; border-bottom: 16px double #facc15; border-left: 4px none #fb7185; }`,
    }));
    expect(result.status).toBe("success");
    const layers = result.protocol?.layers ?? [];
    expect(layers.slice(0, 2).map((layer) => layer.id)).toEqual(["box", "box::paint"]);
    const dashedTop = layers.filter((layer) => layer.id.startsWith("box::border:top:"));
    const dottedRight = layers.filter((layer) => layer.id.startsWith("box::border:right:"));
    const doubleBottom = layers.filter((layer) => layer.id.startsWith("box::border:bottom:"));
    expect(dashedTop).toHaveLength(11);
    expect(dashedTop.every((layer) => layer.type === "shape" && layer.payload.shape === "polygon" && layer.style.fill === "#38bdf8")).toBe(true);
    expect(dottedRight).toHaveLength(6);
    expect(dottedRight.every((layer) => layer.type === "shape" && layer.style.fill === "#a78bfa")).toBe(true);
    expect(dottedRight[0]?.type).toBe("shape");
    expect(dottedRight[0]?.type === "shape" ? dottedRight[0].payload.shape : undefined).toBe("polygon");
    expect(dottedRight[1]?.type === "shape" ? dottedRight[1].payload.shape : undefined).toBe("ellipse");
    expect(dottedRight.at(-1)?.type === "shape" ? dottedRight.at(-1)?.payload.shape : undefined).toBe("polygon");
    expect(doubleBottom.map((layer) => layer.type)).toEqual(["path", "path"]);
    const doubleFrame = doubleBottom[0]?.frame;
    const doubleStarts = doubleBottom.map((layer) => layer.type === "path" ? layer.payload.contours[0]?.start : undefined);
    expect(doubleStarts).toEqual([
      { x: 0, y: (doubleFrame?.height ?? 0) - 16 / 6 },
      { x: 16, y: (doubleFrame?.height ?? 0) - 16 * 5 / 6 },
    ]);
    const doubleEnds = doubleBottom.map((layer) => layer.type === "path" ? layer.payload.contours[0]?.segments[0] : undefined);
    expect(doubleEnds).toEqual([
      { kind: "line", to: { x: doubleFrame?.width, y: (doubleFrame?.height ?? 0) - 16 / 6 } },
      { kind: "line", to: { x: (doubleFrame?.width ?? 0) - 16, y: (doubleFrame?.height ?? 0) - 16 * 5 / 6 } },
    ]);
  });

  it("lowers a uniform double border to two closed contours", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="box"></div>`,
      css: `#box { width: 240px; height: 120px; background: #172554; border: 24px double #38bdf8; }`,
    }));
    expect(result.status).toBe("success");
    const border = result.protocol?.layers.find((layer) => layer.id === "box::border");
    expect(border?.type).toBe("path");
    if (border?.type !== "path") return;
    expect(border.payload.contours).toHaveLength(2);
    expect(border.payload.contours.every((contour) => contour.closed)).toBe(true);
    expect(border.style).toMatchObject({ stroke: "#38bdf8", strokeWidth: 8, strokeJoin: "miter" });
    expect(border.payload.contours[0]?.start).toEqual({ x: 4, y: 4 });
    expect(border.payload.contours[1]?.start).toEqual({ x: 20, y: 20 });
  });

  it("lowers unequal solid sides to filled border polygons with CSS corner joins", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="box"></div>`,
      css: `#box { width: 240px; height: 120px; background: #172554; border-top: 12px solid #38bdf8; border-right: 20px solid #a78bfa; border-bottom: 28px solid #facc15; border-left: 8px solid #fb7185; }`,
    }));
    expect(result.status).toBe("success");
    const borders = result.protocol?.layers.filter((layer) => layer.id.startsWith("box::border:"));
    expect(borders?.map((layer) => layer.type)).toEqual(["shape", "shape", "shape", "shape"]);
    expect(borders?.map((layer) => layer.id)).toEqual([
      "box::border:top", "box::border:right", "box::border:bottom", "box::border:left",
    ]);
    expect(borders?.every((layer) => layer.type === "shape" && layer.payload.shape === "polygon")).toBe(true);
  });

  it("lowers advanced border styles to deterministic paint-only bands", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<div id="box"></div>`,
      css: `#box { width: 240px; height: 120px; background: #172554; border-top: 12px groove #38bdf8; border-right: 12px ridge #38bdf8; border-bottom: 12px inset #38bdf8; border-left: 12px groove #38bdf8; }`,
    }));
    expect(result.status).toBe("success");
    const layers = result.protocol?.layers ?? [];
    const borders = layers.filter((layer) => layer.id.startsWith("box::border:"));
    expect(borders).toHaveLength(7);
    expect(borders.every((layer) => layer.type === "shape" && layer.payload.shape === "polygon")).toBe(true);
    expect(new Set(borders.map((layer) => layer.type === "shape" ? layer.style.fill : ""))).toEqual(new Set(["#70cffa", "#2888b3"]));
    const leftBand = borders.find((layer) => layer.id === "box::border:left:band-0");
    expect(leftBand?.type).toBe("shape");
    if (leftBand?.type === "shape") expect(leftBand.payload.points).toEqual([
      { x: 0, y: 0 }, { x: 0, y: 144 }, { x: 6, y: 138 }, { x: 6, y: 6 },
    ]);
    const content = layers.find((layer) => layer.id === "box");
    expect(content?.frame).toEqual({ width: 264, height: 144 });
  });

  it("uses path geometry for per-corner radius while keeping uniform radius compact", () => {
    const uniform = compileHtmlCss(createHtmlCssSource({ html: `<div id="box"></div>`, css: `#box { width: 240px; height: 120px; background: #fff; border-radius: 20px; }` }));
    const corners = compileHtmlCss(createHtmlCssSource({ html: `<div id="box"></div>`, css: `#box { width: 240px; height: 120px; background: #fff; border: 4px solid #000; border-radius: 20px 4px; }` }));
    expect(uniform.protocol?.layers.find((layer) => layer.id === "box")?.type).toBe("shape");
    expect(corners.protocol?.layers.find((layer) => layer.id === "box::border")?.type).toBe("path");
  });
});
