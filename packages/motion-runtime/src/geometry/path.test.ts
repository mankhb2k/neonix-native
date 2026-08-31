import { describe, expect, it } from "vitest";
import {
  interpolatePathContours,
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

  it("resolves nonzero winding and evenodd parity across nested contours", () => {
    const nonzeroHole = tessellateClosedPath([outer, innerOppositeWinding], "nonzero");
    const evenoddHole = tessellateClosedPath([outer, innerSameWinding], "evenodd");
    const nonzeroFilled = tessellateClosedPath([outer, innerSameWinding], "nonzero");

    expect(meshContainsPoint(nonzeroHole, 10, 50)).toBe(true);
    expect(meshContainsPoint(nonzeroHole, 50, 50)).toBe(false);
    expect(meshContainsPoint(evenoddHole, 50, 50)).toBe(false);
    expect(meshContainsPoint(nonzeroFilled, 50, 50)).toBe(true);
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
});
