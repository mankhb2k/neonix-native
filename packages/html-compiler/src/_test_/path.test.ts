import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../index";

function compilePath(html: string, css: string) {
  const result = compileHtmlCss(createHtmlCssSource({ html, css }));
  expect(result.status).toBe("success");
  return result.protocol?.layers;
}

describe("HTML/CSS compiler path lowering", () => {
  it("lowers SVG line and cubic commands to a V2 path layer", () => {
    const layers = compilePath(
      `<body><svg id="scene"><path id="curve" d="M 0 120 C 80 0 220 0 320 120 L 320 220 L 0 220 Z" /></svg></body>`,
      `body { margin: 0; background: #081018; }
#scene { position: absolute; left: 120px; top: 80px; width: 400px; height: 280px; }
#curve { fill: #14b8a6; fill-opacity: .85; stroke: #ffffff; stroke-width: 8px; stroke-linejoin: round; }`,
    );
    expect(layers).toHaveLength(2);
    expect(layers?.[0]).toMatchObject({ id: "scene", type: "group" });
    expect(layers?.[1]).toMatchObject({
      id: "curve",
      type: "path",
      parentLayerId: "scene",
      payload: { fillRule: "nonzero", contours: [{ closed: true }] },
      style: { fill: "#14b8a6", fillOpacity: 0.85, stroke: "#ffffff", strokeWidth: 8, strokeJoin: "round" },
    });
    const curve = layers?.[1];
    expect(curve?.type === "path" && curve.payload.contours[0]?.segments.some((segment) => segment.kind === "cubic")).toBe(true);
  });

  it("preserves multiple SVG contours and evenodd fill-rule", () => {
    const layers = compilePath(
      `<svg id="donut"><path id="shape" fill-rule="evenodd" d="M 0 0 H 300 V 200 H 0 Z M 80 50 H 220 V 150 H 80 Z" /></svg>`,
      `#donut { position: absolute; left: 100px; top: 100px; width: 300px; height: 200px; }
#shape { fill: #2563eb; }`,
    );
    expect(layers?.[1]).toMatchObject({
      id: "shape",
      type: "path",
      payload: { fillRule: "evenodd", contours: [{ id: "contour-0" }, { id: "contour-1" }] },
    });
  });

  it("fails closed for unsupported SVG path commands", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<svg><path id="bad" d="M 0 0 Q 10 10 20 20 Z" /></svg>`,
      css: `svg { width: 100px; height: 100px; } #bad { fill: #ffffff; }`,
    }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("svg-path-command-unsupported");
  });

  it("rejects an open contour when it is filled", () => {
    const result = compileHtmlCss(createHtmlCssSource({
      html: `<svg><path id="open" d="M 0 0 L 80 0 L 40 60" /></svg>`,
      css: `svg { width: 100px; height: 100px; } #open { fill: #ffffff; }`,
    }));
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("svg-path-fill-open");
  });
});
