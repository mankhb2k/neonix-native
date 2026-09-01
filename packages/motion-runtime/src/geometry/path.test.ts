import { describe, expect, it } from "vitest";
import {
  interpolatePathContours,
  tessellateNonScalingStroke,
  tessellateClosedPath,
  tessellatePathStroke,
} from "./path";
import {
  canonicalizePathPoints,
  dashContour,
  flattenPathContourAny,
  measureContour,
  normalizePathDash,
  sampleContourAtDistance,
} from "./path";

const outer = {
  id: "outer",
  start: { x: 0, y: 0 },
  segments: [
    { kind: "line" as const, to: { x: 100, y: 0 } },
    { kind: "line" as const, to: { x: 100, y: 100 } },
    { kind: "line" as const, to: { x: 0, y: 100 } },
    { kind: "line" as const, to: { x: 0, y: 0 } },
  ],
  closed: true as const,
};

const innerSameWinding = {
  id: "inner-same",
  start: { x: 25, y: 25 },
  segments: [
    { kind: "line" as const, to: { x: 75, y: 25 } },
    { kind: "line" as const, to: { x: 75, y: 75 } },
    { kind: "line" as const, to: { x: 25, y: 75 } },
    { kind: "line" as const, to: { x: 25, y: 25 } },
  ],
  closed: true as const,
};

const innerOppositeWinding = {
  ...innerSameWinding,
  id: "inner-opposite",
  segments: [
    { kind: "line" as const, to: { x: 25, y: 75 } },
    { kind: "line" as const, to: { x: 75, y: 75 } },
    { kind: "line" as const, to: { x: 75, y: 25 } },
    { kind: "line" as const, to: { x: 25, y: 25 } },
  ],
};

const fivePointStar = {
  id: "five-point-star",
  start: { x: 50, y: 0 },
  segments: [
    { kind: "line" as const, to: { x: 95, y: 80 } },
    { kind: "line" as const, to: { x: 5, y: 30 } },
    { kind: "line" as const, to: { x: 95, y: 30 } },
    { kind: "line" as const, to: { x: 5, y: 80 } },
    { kind: "line" as const, to: { x: 50, y: 0 } },
  ],
  closed: true as const,
};

const openLine = {
  id: "open-line",
  start: { x: 0, y: 0 },
  segments: [{ kind: "line" as const, to: { x: 100, y: 0 } }],
  closed: false as const,
};

const calibratedLine = {
  ...openLine,
  id: "calibrated-line",
  pathLength: 50,
};

function meshContainsPoint(mesh: { vertices: number[]; indices: number[] }, x: number, y: number): boolean {
  const cross = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
    (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const points = [0, 1, 2].map((offset) => {
      const vertex = mesh.indices[index + offset]! * 2;
      return [mesh.vertices[vertex]!, mesh.vertices[vertex + 1]!] as const;
    });
    const signs = [
      cross(...points[0]!, ...points[1]!, x, y),
      cross(...points[1]!, ...points[2]!, x, y),
      cross(...points[2]!, ...points[0]!, x, y),
    ];
    if (signs.every((value) => value >= -1e-7) || signs.every((value) => value <= 1e-7)) return true;
  }
  return false;
}

describe("Path tessellation", () => {
  it("normalizes SVG dash patterns and negative offsets", () => {
    expect(normalizePathDash({ array: [10, 5, 2], offset: -4 })).toEqual({
      pattern: [10, 5, 2, 10, 5, 2],
      total: 34,
      offset: 30,
    });
  });

  it("measures closed contours including the closing edge", () => {
    const measured = measureContour(flattenPathContourAny(outer));
    expect(measured.length).toBe(400);
    expect(sampleContourAtDistance(measured, 350)).toEqual({
      point: { x: 0, y: 50 },
      tangent: { x: 0, y: -1 },
    });
  });

  it("keeps SVG dash runs continuous across segment boundaries", () => {
    const measured = measureContour(flattenPathContourAny(outer));
    const runs = dashContour(measured, { array: [150, 50], offset: 0 });
    expect(runs).toHaveLength(2);
    expect(runs[0]).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
  });

  it("applies SVG pathLength calibration before generating dash runs", () => {
    const measured = measureContour(flattenPathContourAny(calibratedLine));
    const runs = dashContour(measured, { array: [10, 10], offset: 0 });
    expect(runs[0]).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }]);
    expect(runs[1]).toEqual([{ x: 40, y: 0 }, { x: 60, y: 0 }]);
  });

  it("canonicalizes SVG-like closed contours without a repeated closing point", () => {
    expect(canonicalizePathPoints([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 0 },
    ], true)).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
    ]);
  });

  it("resolves one closed triangle into local-plane triangles", () => {
    const mesh = tessellateClosedPath([
      {
        id: "triangle",
        start: { x: 20, y: 10 },
        segments: [
          { kind: "line", to: { x: 180, y: 40 } },
          { kind: "line", to: { x: 70, y: 150 } },
          { kind: "line", to: { x: 20, y: 10 } },
        ],
        closed: true,
      },
    ]);

    expect(mesh.vertices.length).toBeGreaterThanOrEqual(8);
    expect(mesh.indices.length).toBeGreaterThanOrEqual(6);
    expect(mesh.bounds).toEqual({ x: 20, y: 10, width: 160, height: 140 });
  });

  it("flattens cubic commands before tessellation", () => {
    const mesh = tessellateClosedPath([
      {
        id: "cubic",
        start: { x: 0, y: 0 },
        segments: [
          {
            kind: "cubic",
            control1: { x: 80, y: -40 },
            control2: { x: 120, y: 120 },
            to: { x: 200, y: 80 },
          },
          { kind: "line", to: { x: 0, y: 160 } },
          { kind: "line", to: { x: 0, y: 0 } },
        ],
        closed: true,
      },
    ]);

    expect(mesh.vertices.length).toBeGreaterThan(8);
    expect(mesh.indices.length).toBeGreaterThan(6);
  });

  it("flattens quadratic commands before tessellation", () => {
    const contour = {
      id: "quadratic",
      start: { x: 0, y: 100 },
      segments: [
        { kind: "quadratic" as const, control: { x: 100, y: -80 }, to: { x: 200, y: 100 } },
        { kind: "line" as const, to: { x: 0, y: 100 } },
      ],
      closed: true as const,
    };
    const flattened = flattenPathContourAny(contour);
    const mesh = tessellateClosedPath([contour]);

    expect(flattened.points.length).toBeGreaterThan(2);
    expect(flattened.points[0]).toEqual({ x: 0, y: 100 });
    expect(mesh.indices.length).toBeGreaterThan(6);
    expect(mesh.vertices.every(Number.isFinite)).toBe(true);
  });

  it("flattens SVG endpoint-parameterized arcs with exact endpoints", () => {
    const contour = {
      id: "arc",
      start: { x: 220, y: 270 },
      segments: [
        { kind: "arc" as const, radii: { x: 220, y: 150 }, rotation: 0, largeArc: false, sweep: true, to: { x: 740, y: 270 } },
        { kind: "line" as const, to: { x: 220, y: 270 } },
      ],
      closed: true as const,
    };
    const flattened = flattenPathContourAny(contour);
    const mesh = tessellateClosedPath([contour]);

    expect(flattened.points.length).toBeGreaterThan(10);
    expect(flattened.points[0]).toEqual({ x: 220, y: 270 });
    // Canonical closed contours intentionally omit the repeated closing point;
    // the arc endpoint must still be exact before the closing edge is implied.
    expect(flattened.points.at(-1)).toEqual({ x: 740, y: 270 });
    expect(mesh.indices.length).toBeGreaterThan(6);
    expect(mesh.vertices.every(Number.isFinite)).toBe(true);
  });

  it("resolves nonzero winding and evenodd parity across nested contours", () => {
    const nonzeroHole = tessellateClosedPath([outer, innerOppositeWinding], "nonzero");
    const evenoddHole = tessellateClosedPath([outer, innerSameWinding], "evenodd");
    const nonzeroFilled = tessellateClosedPath([outer, innerSameWinding], "nonzero");

    expect(meshContainsPoint(nonzeroHole, 10, 50)).toBe(true);
    expect(meshContainsPoint(nonzeroHole, 50, 50)).toBe(false);
    expect(meshContainsPoint(evenoddHole, 50, 50)).toBe(false);
    expect(meshContainsPoint(nonzeroFilled, 50, 50)).toBe(true);
  });

  it("implicitly closes an open contour for SVG fill without changing stroke openness", () => {
    const openContour = {
      id: "open-fill",
      start: { x: 10, y: 10 },
      segments: [
        { kind: "line" as const, to: { x: 90, y: 10 } },
        { kind: "line" as const, to: { x: 50, y: 90 } },
      ],
      closed: false as const,
    };

    const fill = tessellateClosedPath([openContour]);
    const stroke = tessellatePathStroke([openContour], 8, { cap: "butt" });

    expect(meshContainsPoint(fill, 50, 35)).toBe(true);
    expect(fill.bounds).toEqual({ x: 10, y: 10, width: 80, height: 80 });
    expect(stroke.bounds).not.toEqual(fill.bounds);
  });

  it("distinguishes nonzero and evenodd at a five-point self-intersection", () => {
    const nonzero = tessellateClosedPath([fivePointStar], "nonzero");
    const evenodd = tessellateClosedPath([fivePointStar], "evenodd");

    expect(meshContainsPoint(nonzero, 50, 40)).toBe(true);
    expect(meshContainsPoint(evenodd, 50, 40)).toBe(false);
  });

  it("resolves a closed path stroke into local-plane triangle strips", () => {
    const mesh = tessellatePathStroke([outer], 12, { join: "bevel" });

    expect(mesh.indices.length).toBeGreaterThanOrEqual(outer.segments.length * 6);
    expect(mesh.vertices.every(Number.isFinite)).toBe(true);
    expect(mesh.bounds).toEqual({ x: -6, y: -6, width: 112, height: 112 });
  });

  it("resolves joins, round caps, and deterministic dash runs", () => {
    const bevel = tessellatePathStroke([outer], 12, { join: "bevel" });
    const round = tessellatePathStroke([openLine], 12, {
      cap: "round",
      dash: { array: [20, 10], offset: 0 },
    });
    const butt = tessellatePathStroke([openLine], 12, { cap: "butt" });

    expect(bevel.indices.length).toBeGreaterThan(outer.segments.length * 6);
    expect(round.indices.length).toBeGreaterThan(butt.indices.length);
    expect(round.vertices.every(Number.isFinite)).toBe(true);
  });

  it("keeps non-scaling stroke width fixed after a 2D scale", () => {
    const contour = {
      id: "non-scaling-line",
      start: { x: 20, y: 40 },
      segments: [{ kind: "line" as const, to: { x: 120, y: 40 } }],
      closed: false as const,
    };
    const scaled = new Float64Array([
      2, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    const mesh = tessellateNonScalingStroke([contour], 10, scaled, { cap: "butt" });

    expect(mesh?.bounds).toEqual({ x: 40, y: 75, width: 200, height: 10 });
  });

  it("does not claim non-scaling-stroke for perspective matrices", () => {
    const perspective = new Float64Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0.01,
      0, 0, 0, 1,
    ]);
    expect(tessellateNonScalingStroke([openLine], 10, perspective)).toBeUndefined();
  });

  it("covers the miter apex continuously", () => {
    const mesh = tessellatePathStroke([{
      id: "miter-join",
      start: { x: 40, y: 140 },
      segments: [
        { kind: "line", to: { x: 210, y: 20 } },
        { kind: "line", to: { x: 380, y: 140 } },
      ],
      closed: false,
    }], 28, { join: "miter", cap: "butt" });

    expect(meshContainsPoint(mesh, 210, 4)).toBe(true);
    expect(mesh.vertices.every(Number.isFinite)).toBe(true);
  });

  it("covers the outside sector of a round join without a vertex gap", () => {
    const mesh = tessellatePathStroke([{
      id: "round-join",
      start: { x: 40, y: 140 },
      segments: [
        { kind: "line", to: { x: 210, y: 20 } },
        { kind: "line", to: { x: 380, y: 140 } },
      ],
      closed: false,
    }], 28, { join: "round", cap: "butt" });

    expect(meshContainsPoint(mesh, 210, 8)).toBe(true);
    expect(meshContainsPoint(mesh, 210, 7)).toBe(true);
  });

  it("approximates a round join with a fine circular arc", () => {
    const mesh = tessellatePathStroke([{
      id: "fine-round-join",
      start: { x: 40, y: 140 },
      segments: [
        { kind: "line", to: { x: 210, y: 20 } },
        { kind: "line", to: { x: 380, y: 140 } },
      ],
      closed: false,
    }], 28, { join: "round", cap: "butt" });

    // The outside arc is split into more than the old coarse 18-degree
    // tessellation, preventing visible polygon facets in the GPU preview.
    expect(mesh.indices.length).toBeGreaterThan(30);
    expect(mesh.vertices.every(Number.isFinite)).toBe(true);
  });

  it("interpolates matching contour topology before tessellation", () => {
    const target = {
      ...fivePointStar,
      start: { x: 60, y: 10 },
      segments: fivePointStar.segments.map((segment) =>
        segment.kind === "line"
          ? { kind: "line" as const, to: { x: segment.to.x + 10, y: segment.to.y + 20 } }
          : segment,
      ),
    };
    const midpoint = interpolatePathContours([fivePointStar], [target], 0.5)[0]!;

    expect(midpoint.start).toEqual({ x: 55, y: 5 });
    expect(midpoint.segments).toHaveLength(fivePointStar.segments.length);
    expect(() => interpolatePathContours([fivePointStar], [outer], 0.5)).toThrow(/topology mismatch/);
  });

  it("interpolates quadratic and arc geometry without changing command topology", () => {
    const quadratic = {
      id: "quadratic",
      start: { x: 0, y: 100 },
      segments: [{ kind: "quadratic" as const, control: { x: 100, y: 0 }, to: { x: 200, y: 100 } }],
      closed: false as const,
    };
    const arc = {
      id: "arc",
      start: { x: 0, y: 100 },
      segments: [{ kind: "arc" as const, radii: { x: 100, y: 80 }, rotation: 0, largeArc: false, sweep: true, to: { x: 200, y: 100 } }],
      closed: false as const,
    };
    const quadraticTarget = { ...quadratic, segments: [{ kind: "quadratic" as const, control: { x: 100, y: 200 }, to: { x: 300, y: 100 } }] };
    const arcTarget = { ...arc, segments: [{ kind: "arc" as const, radii: { x: 140, y: 120 }, rotation: 30, largeArc: true, sweep: false, to: { x: 240, y: 100 } }] };
    const quadraticMidpoint = interpolatePathContours([quadratic], [quadraticTarget], 0.5)[0]!;
    const arcMidpoint = interpolatePathContours([arc], [arcTarget], 0.5)[0]!;

    expect(quadraticMidpoint.segments[0]).toEqual({ kind: "quadratic", control: { x: 100, y: 100 }, to: { x: 250, y: 100 } });
    expect(arcMidpoint.segments[0]).toEqual({ kind: "arc", radii: { x: 120, y: 100 }, rotation: 15, largeArc: true, sweep: false, to: { x: 220, y: 100 } });
  });
});
