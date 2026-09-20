/**
 * Path contour builders shared across borders, outlines, masks and clips:
 * plain rectangles and rounded rectangles (as cubic-bezier corners) at an
 * arbitrary inset. No dependency on the compiler's node/style model beyond
 * the CornerRadius shape.
 */

import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { CornerRadius } from "../paint";

export type HtmlPathContour = Extract<MotionProtocolV2["layers"][number], { type: "path" }>["payload"]["contours"][number];

const DEGENERATE_SEGMENT_EPSILON = 1e-6;

/**
 * Drop a "line" segment whose start and end coincide -- the straight run
 * between two adjacent corner arcs collapses to zero length when a radius
 * consumes an entire side (e.g. a pill/stadium shape). A zero-length line
 * verb still occupies a distinct position in the contour, and a strokeDash
 * walking the path (used for rounded dashed/dotted borders) measures arc
 * length verb-by-verb: leaving the degenerate verb in was observed to throw
 * the dash phase off by up to half a period for the rest of the contour,
 * rendering as an extra dot/dash overlapping its neighbor. Cubic segments
 * (the actual corner arcs) are never zero-length here and are left alone.
 */
function dropDegenerateLines(start: { x: number; y: number }, segments: HtmlPathContour["segments"]): HtmlPathContour["segments"] {
  const kept: HtmlPathContour["segments"] = [];
  let current = start;
  for (const segment of segments) {
    if (segment.kind === "line" && Math.abs(segment.to.x - current.x) <= DEGENERATE_SEGMENT_EPSILON && Math.abs(segment.to.y - current.y) <= DEGENERATE_SEGMENT_EPSILON) {
      continue;
    }
    kept.push(segment);
    current = segment.to;
  }
  return kept;
}

export function roundedRectContour(width: number, height: number, radius: Exclude<CornerRadius, number>): HtmlPathContour {
  const { topLeft, topRight, bottomRight, bottomLeft } = radius;
  const k = 0.5522847498;
  const start = { x: topLeft.rx, y: 0 };
  const segments: HtmlPathContour["segments"] = [
    { kind: "line", to: { x: width - topRight.rx, y: 0 } },
    { kind: "cubic", control1: { x: width - topRight.rx + k * topRight.rx, y: 0 }, control2: { x: width, y: topRight.ry - k * topRight.ry }, to: { x: width, y: topRight.ry } },
    { kind: "line", to: { x: width, y: height - bottomRight.ry } },
    { kind: "cubic", control1: { x: width, y: height - bottomRight.ry + k * bottomRight.ry }, control2: { x: width - bottomRight.rx + k * bottomRight.rx, y: height }, to: { x: width - bottomRight.rx, y: height } },
    { kind: "line", to: { x: bottomLeft.rx, y: height } },
    { kind: "cubic", control1: { x: bottomLeft.rx - k * bottomLeft.rx, y: height }, control2: { x: 0, y: height - bottomLeft.ry + k * bottomLeft.ry }, to: { x: 0, y: height - bottomLeft.ry } },
    { kind: "line", to: { x: 0, y: topLeft.ry } },
    { kind: "cubic", control1: { x: 0, y: topLeft.ry - k * topLeft.ry }, control2: { x: topLeft.rx - k * topLeft.rx, y: 0 }, to: { x: topLeft.rx, y: 0 } },
  ];
  return { id: "rounded-rectangle-contour", start, segments: dropDegenerateLines(start, segments), closed: true };
}

export function rectangleContour(width: number, height: number, inset: number, id: string): HtmlPathContour {
  return {
    id,
    start: { x: inset, y: inset },
    segments: [
      { kind: "line", to: { x: width - inset, y: inset } },
      { kind: "line", to: { x: width - inset, y: height - inset } },
      { kind: "line", to: { x: inset, y: height - inset } },
      { kind: "line", to: { x: inset, y: inset } },
    ],
    closed: true,
  };
}

export function roundedRectContourAtInset(width: number, height: number, inset: number, radius: Exclude<CornerRadius, number>, id: string): HtmlPathContour {
  const { topLeft, topRight, bottomRight, bottomLeft } = radius;
  const k = 0.5522847498;
  const left = inset;
  const top = inset;
  const right = width - inset;
  const bottom = height - inset;
  const start = { x: left + topLeft.rx, y: top };
  const segments: HtmlPathContour["segments"] = [
    { kind: "line", to: { x: right - topRight.rx, y: top } },
    { kind: "cubic", control1: { x: right - topRight.rx + k * topRight.rx, y: top }, control2: { x: right, y: top + topRight.ry - k * topRight.ry }, to: { x: right, y: top + topRight.ry } },
    { kind: "line", to: { x: right, y: bottom - bottomRight.ry } },
    { kind: "cubic", control1: { x: right, y: bottom - bottomRight.ry + k * bottomRight.ry }, control2: { x: right - bottomRight.rx + k * bottomRight.rx, y: bottom }, to: { x: right - bottomRight.rx, y: bottom } },
    { kind: "line", to: { x: left + bottomLeft.rx, y: bottom } },
    { kind: "cubic", control1: { x: left + bottomLeft.rx - k * bottomLeft.rx, y: bottom }, control2: { x: left, y: bottom - bottomLeft.ry + k * bottomLeft.ry }, to: { x: left, y: bottom - bottomLeft.ry } },
    { kind: "line", to: { x: left, y: top + topLeft.ry } },
    { kind: "cubic", control1: { x: left, y: top + topLeft.ry - k * topLeft.ry }, control2: { x: left + topLeft.rx - k * topLeft.rx, y: top }, to: { x: left + topLeft.rx, y: top } },
  ];
  return { id, start, segments: dropDegenerateLines(start, segments), closed: true };
}
