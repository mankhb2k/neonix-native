import { describe, expect, it } from "vitest";
import { FRAGMENT_SHADER } from "./webgl2/shaders";
import { SHADER as WEBGPU_SHADER } from "./webgpu/shaders";

type Point = { x: number; y: number };

function roundedBoxDistance(point: Point, halfSize: Point, radius: number): number {
  const q = {
    x: Math.abs(point.x) - (halfSize.x - radius),
    y: Math.abs(point.y) - (halfSize.y - radius),
  };
  return Math.hypot(Math.max(q.x, 0), Math.max(q.y, 0)) + Math.min(Math.max(q.x, q.y), 0) - radius;
}

function insideStrokeContains(
  point: Point,
  halfSize: Point,
  radius: number,
  strokeWidth: number,
): boolean {
  const outer = roundedBoxDistance(point, halfSize, radius);
  const inner = roundedBoxDistance(
    point,
    { x: halfSize.x - strokeWidth, y: halfSize.y - strokeWidth },
    Math.max(radius - strokeWidth, 0),
  );
  return outer <= 0 && inner >= 0;
}

function legacyHalfStrokeContains(
  point: Point,
  halfSize: Point,
  radius: number,
  strokeWidth: number,
): boolean {
  const halfStroke = strokeWidth / 2;
  const outer = roundedBoxDistance(point, halfSize, radius);
  const inner = roundedBoxDistance(
    point,
    { x: halfSize.x - halfStroke, y: halfSize.y - halfStroke },
    Math.max(radius - halfStroke, 0),
  );
  return outer <= 0 && inner >= 0;
}

function rotate(point: Point, degrees: number): Point {
  const radians = degrees * Math.PI / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}

function inverseRotate(point: Point, degrees: number): Point {
  return rotate(point, -degrees);
}

describe("thin rounded stroke raster contract", () => {
  it("keeps the requested 3px stroke inside the frame instead of clipping half of it", () => {
    const halfSize = { x: 160, y: 90 };
    const radius = 28;
    const strokeWidth = 3;
    // This is 2.25 composition pixels inside the straight top edge.
    const sample = { x: 0, y: -halfSize.y + 2.25 };

    expect(legacyHalfStrokeContains(sample, halfSize, radius, strokeWidth)).toBe(false);
    expect(insideStrokeContains(sample, halfSize, radius, strokeWidth)).toBe(true);
  });

  it.each([-30, -15, 15, 30])("has a continuous full-width ring after %d° rotation", (angle) => {
    const halfSize = { x: 160, y: 90 };
    const radius = 28;
    const strokeWidth = 3;

    // Sample a long strip along the rotated top edge. Mapping every screen
    // sample back into the local SDF must retain the complete 3px band.
    for (let x = -120; x <= 120; x += 2) {
      for (const depth of [0.5, 1.5, 2.5]) {
        const screenPoint = rotate({ x, y: -halfSize.y + depth }, angle);
        const localPoint = inverseRotate(screenPoint, angle);
        expect(insideStrokeContains(localPoint, halfSize, radius, strokeWidth)).toBe(true);
      }
    }
  });

  it("keeps both GPU shader implementations on the same inside-stroke rule", () => {
    expect(FRAGMENT_SHADER).toContain("precision highp float");
    expect(FRAGMENT_SHADER).toContain("2.0 * u_stroke_extent");
    expect(FRAGMENT_SHADER).toContain("halfSize - vec2(strokeWidth)");
    expect(FRAGMENT_SHADER).not.toContain("halfStroke");

    expect(WEBGPU_SHADER).toContain("2.0 * uniforms.params.zw");
    expect(WEBGPU_SHADER).toContain("halfSize - vec2<f32>(strokeWidth, strokeWidth)");
    expect(WEBGPU_SHADER).not.toContain("halfStroke");
  });
});
