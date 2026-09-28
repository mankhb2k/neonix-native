import { describe, expect, it } from "vitest";
import { compileHtmlCss, createHtmlCssSource } from "../src/index";

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

  // Both added to unblock debug/neonix_physics_path_showcase.html and
  // debug/neonix_particle_showcase.html, which authored offset-path arcs
  // (physics orbits) and a smooth-cubic curve (the particle stream) - see
  // debt-technical.md.
  it("lowers an SVG elliptical arc (A) to a V2 arc segment, endpoint parameterization verbatim", () => {
    const layers = compilePath(
      `<svg id="scene"><path id="arc" d="M 10 50 A 40 40 0 0 1 90 50 Z" /></svg>`,
      `#scene { position: absolute; width: 100px; height: 100px; } #arc { fill: #14b8a6; }`,
    );
    const arc = layers?.[1];
    const segments = arc?.type === "path" ? arc.payload.contours[0]?.segments : undefined;
    expect(segments?.[0]).toEqual({ kind: "arc", radii: { x: 40, y: 40 }, rotation: 0, largeArc: false, sweep: true, to: { x: 90, y: 50 } });
  });

  it("normalizes glued arc flags (a real regex tokenizer merges unseparated 0/1 digits into the next number)", () => {
    const layers = compilePath(
      // No separator at all between the two flags and the x coordinate -
      // the master tokenizer greedily reads "10200" as one number token.
      `<svg id="scene"><path id="arc" d="M 0 0 A 10 10 0 10200 50 Z" /></svg>`,
      `#scene { position: absolute; width: 300px; height: 300px; } #arc { fill: #14b8a6; }`,
    );
    const arc = layers?.[1];
    const segments = arc?.type === "path" ? arc.payload.contours[0]?.segments : undefined;
    expect(segments?.[0]).toMatchObject({ kind: "arc", largeArc: true, sweep: false, to: { x: 200, y: 50 } });
  });

  it("lowers a smooth cubic (S) by reflecting the preceding cubic's control2 through the cursor", () => {
    const layers = compilePath(
      `<svg id="scene"><path id="s" d="M 0 0 C 0 -50 50 -50 50 0 S 100 50 100 0" /></svg>`,
      `#scene { position: absolute; width: 200px; height: 100px; } #s { fill: none; stroke: #ffffff; }`,
    );
    const path = layers?.[1];
    const segments = path?.type === "path" ? path.payload.contours[0]?.segments : undefined;
    expect(segments).toHaveLength(2);
    expect(segments?.[1]).toEqual({ kind: "cubic", control1: { x: 50, y: 50 }, control2: { x: 100, y: 50 }, to: { x: 100, y: 0 } });
  });

  it("treats a smooth cubic (S) with no preceding cubic as coincident with the cursor", () => {
    const layers = compilePath(
      `<svg id="scene"><path id="s" d="M 0 0 L 10 10 S 50 50 60 0" /></svg>`,
      `#scene { position: absolute; width: 200px; height: 100px; } #s { fill: none; stroke: #ffffff; }`,
    );
    const path = layers?.[1];
    const segments = path?.type === "path" ? path.payload.contours[0]?.segments : undefined;
    expect(segments?.[1]).toEqual({ kind: "cubic", control1: { x: 10, y: 10 }, control2: { x: 50, y: 50 }, to: { x: 60, y: 0 } });
  });
});
