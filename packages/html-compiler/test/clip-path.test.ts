import { describe, expect, it } from "vitest";
import { parseClipPath } from "../src/compiler/paint/clip";

const box = { x: 0, y: 0, width: 200, height: 200 };
const boxes = { borderBox: box, paddingBox: box, contentBox: box };

// Regression test: `circle(0% at 50% 50%)`/`ellipse(0 0 ...)` is valid CSS -
// the natural starting keyframe of a growing "iris reveal" clip-path
// animation, and a real browser just clips the element away to nothing for
// that instant. A mathematically exact zero radius collapsed every one of
// this contour's 4 arc endpoints onto one identical point, which
// motion-runtime's shared path tessellator (flattenPathContourAny) rejects
// outright ("not enough non-collinear points"), crashing the whole
// compileProtocol pipeline the first time a real fixture authored this -
// see debt-technical.md and neonix_ui_transform_showcase.html's Act 10.
describe("clip-path radial radius floor", () => {
  it("floors a circle(0%) radius to an imperceptible epsilon instead of a literal 0", () => {
    const node = parseClipPath("circle(0% at 50% 50%)", boxes);
    expect(node?.type).toBe("path");
    const contour = node?.type === "path" ? node.contours[0] : undefined;
    const radii = contour?.segments.map((segment) => (segment.kind === "arc" ? segment.radii.x : undefined));
    expect(radii?.every((radius) => radius !== undefined && radius > 0)).toBe(true);
  });

  it("floors an ellipse(0 0) radius to an imperceptible epsilon on both axes", () => {
    const node = parseClipPath("ellipse(0 0 at 50% 50%)", boxes);
    const contour = node?.type === "path" ? node.contours[0] : undefined;
    const radii = contour?.segments.flatMap((segment) => (segment.kind === "arc" ? [segment.radii.x, segment.radii.y] : []));
    expect(radii?.every((radius) => radius > 0)).toBe(true);
  });

  it("leaves an ordinary non-zero circle radius untouched", () => {
    const node = parseClipPath("circle(75% at 50% 50%)", boxes);
    const contour = node?.type === "path" ? node.contours[0] : undefined;
    const firstArc = contour?.segments.find((segment) => segment.kind === "arc");
    // radialRadius() resolves a plain percentage against box.width (200), not
    // "distance to nearest side" (that's only closest-side/farthest-side).
    expect(firstArc?.kind === "arc" ? firstArc.radii.x : undefined).toBeCloseTo(150, 0);
  });
});
