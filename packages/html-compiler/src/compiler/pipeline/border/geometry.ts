/**
 * Pure 2D geometry helpers for lowering CSS borders (solid/double/groove/
 * ridge/inset/outset/dashed/dotted, sharp corners only -- rounded-corner
 * border paths live in shape-contours.ts). No dependency on the compiler's
 * node/style model: every function here takes plain numbers and points.
 */

export type HtmlPoint = { x: number; y: number };

export type BorderDashRun = { offset: number; length: number };

function polygonArea(points: readonly HtmlPoint[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

export function clipConvexPolygon(subject: readonly HtmlPoint[], clip: readonly HtmlPoint[]): HtmlPoint[] {
  const orientation = polygonArea(clip) >= 0 ? 1 : -1;
  const inside = (point: HtmlPoint, from: HtmlPoint, to: HtmlPoint) => orientation * ((to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)) >= -1e-7;
  const intersection = (start: HtmlPoint, end: HtmlPoint, from: HtmlPoint, to: HtmlPoint): HtmlPoint => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const ex = to.x - from.x;
    const ey = to.y - from.y;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) <= 1e-9) return end;
    const t = ((from.x - start.x) * ey - (from.y - start.y) * ex) / denominator;
    return { x: start.x + dx * t, y: start.y + dy * t };
  };
  let output = [...subject];
  for (let index = 0; index < clip.length && output.length > 0; index += 1) {
    const from = clip[index]!;
    const to = clip[(index + 1) % clip.length]!;
    const input = output;
    output = [];
    for (let pointIndex = 0; pointIndex < input.length; pointIndex += 1) {
      const start = input[pointIndex]!;
      const end = input[(pointIndex + 1) % input.length]!;
      const startInside = inside(start, from, to);
      const endInside = inside(end, from, to);
      if (startInside && endInside) output.push(end);
      else if (startInside && !endInside) output.push(intersection(start, end, from, to));
      else if (!startInside && endInside) output.push(intersection(start, end, from, to), end);
    }
  }
  return output;
}

export function borderRegion(side: "top" | "right" | "bottom" | "left", width: number, height: number, top: number, right: number, bottom: number, left: number): HtmlPoint[] {
  if (side === "top") return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width - right, y: top }, { x: left, y: top }];
  if (side === "right") return [{ x: width, y: 0 }, { x: width, y: height }, { x: width - right, y: height - bottom }, { x: width - right, y: top }];
  if (side === "bottom") return [{ x: 0, y: height }, { x: width, y: height }, { x: width - right, y: height - bottom }, { x: left, y: height - bottom }];
  // Keep the same correspondence as the other sides: outer edge first,
  // inner edge second. This lets borderBand split by thickness rather than
  // accidentally splitting the left edge along its length.
  return [{ x: 0, y: 0 }, { x: 0, y: height }, { x: left, y: height - bottom }, { x: left, y: top }];
}

export function shadeBorderColor(color: string, amount: number): string {
  const match = color.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!match) return color;
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(match[1]!.slice(offset, offset + 2), 16));
  const adjusted = rgb.map((channel) => Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount)));
  return `#${adjusted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}${match[2] ?? ""}`;
}

export function borderBand(region: HtmlPoint[], from: number, to: number): HtmlPoint[] {
  const lerp = (outer: HtmlPoint, inner: HtmlPoint, amount: number): HtmlPoint => ({
    x: outer.x + (inner.x - outer.x) * amount,
    y: outer.y + (inner.y - outer.y) * amount,
  });
  const startAt = (amount: number) => lerp(region[0]!, region[3]!, amount);
  const endAt = (amount: number) => lerp(region[1]!, region[2]!, amount);
  return [startAt(from), endAt(from), endAt(to), startAt(to)];
}

export function circlePolygon(center: HtmlPoint, radius: number, count = 32): HtmlPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

/**
 * CSS border dash lengths are not exposed as SVG dasharray values. Fitting
 * this rhythm to match the real browser (verified pixel-for-pixel against
 * Chrome across border-width 10-80px and edge lengths 140-600px) requires a
 * FIXED-length dash (2x border-width) or dot (1x border-width) repeated a
 * whole number of times N, ANCHORED at both ends of the edge, with the
 * leftover space split evenly into (N-1) gaps -- not a periodic tiling that
 * only anchors the start (which is what left half the corners of every
 * dashed/dotted box without a border-radius under-filled). N is chosen to
 * land the gap as close as possible to one border-width:
 *   N = round((edgeLength + width) / (unit + width))
 * If the rounded N doesn't fit (N * unit > edgeLength), Chrome falls back to
 * a single run that spans the whole edge (dashed: one solid-looking dash;
 * dotted: one centered dot) rather than reducing further.
 *
 * This only covers the SHARP-corner case (no border-radius): each edge is
 * fit independently since it is drawn as its own set of discrete polygons.
 * A rounded border instead needs a real strokeDash on one continuous path
 * (see shape-contours.ts's roundedRectContour, used with a dashed stroke).
 */
export function fitBorderDashRuns(length: number, width: number, style: "dashed" | "dotted"): BorderDashRun[] {
  const unit = style === "dashed" ? width * 2 : width;
  const denominator = Math.max(unit + width, 1e-6);
  let count = Math.max(1, Math.round((length + width) / denominator));
  while (count > 1 && count * unit > length) count -= 1;
  if (count <= 1 || count * unit > length) {
    return style === "dashed" ? [{ offset: 0, length: Math.max(length, 0) }] : [{ offset: length / 2, length: width }];
  }
  const gap = (length - count * unit) / (count - 1);
  const period = unit + gap;
  if (style === "dashed") return Array.from({ length: count }, (_, index) => ({ offset: index * period, length: unit }));
  return Array.from({ length: count }, (_, index) => ({ offset: index * period + width / 2, length: width }));
}

type CornerRadii = { topLeft: { rx: number; ry: number }; topRight: { rx: number; ry: number }; bottomRight: { rx: number; ry: number }; bottomLeft: { rx: number; ry: number } };

/** Ramanujan's second approximation for an ellipse's perimeter, quartered for one 90deg corner. Exact when rx === ry (the common circular-radius case). */
function quarterEllipseArcLength(rx: number, ry: number): number {
  if (rx <= 0 && ry <= 0) return 0;
  const h = (rx - ry) ** 2 / ((rx + ry) ** 2 || 1);
  const fullPerimeter = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  return fullPerimeter / 4;
}

export function roundedRectPerimeter(width: number, height: number, radius: CornerRadii): number {
  const straightTop = Math.max(0, width - radius.topLeft.rx - radius.topRight.rx);
  const straightBottom = Math.max(0, width - radius.bottomLeft.rx - radius.bottomRight.rx);
  const straightLeft = Math.max(0, height - radius.topLeft.ry - radius.bottomLeft.ry);
  const straightRight = Math.max(0, height - radius.topRight.ry - radius.bottomRight.ry);
  const arcs = quarterEllipseArcLength(radius.topLeft.rx, radius.topLeft.ry)
    + quarterEllipseArcLength(radius.topRight.rx, radius.topRight.ry)
    + quarterEllipseArcLength(radius.bottomRight.rx, radius.bottomRight.ry)
    + quarterEllipseArcLength(radius.bottomLeft.rx, radius.bottomLeft.ry);
  return straightTop + straightBottom + straightLeft + straightRight + arcs;
}

/**
 * Closed-loop counterpart of fitBorderDashRuns. A sharp-corner border is 4
 * independent OPEN edges, each anchored at both ends -- but a rounded
 * border's dashed/dotted stroke is ONE CLOSED path, so the pattern must
 * tile the whole perimeter an integer number of times (N units, N gaps --
 * not N-1, since the path wraps back onto its own start point instead of
 * stopping). A fixed, unadjusted [2w, w] array (this file's previous
 * approach) only closes cleanly when the perimeter happens to be an exact
 * multiple of 3w; otherwise the pattern visibly seams -- overlapping or
 * gapping -- exactly at the path's start point. N is chosen the same way
 * as the open-edge case: as close as possible to a target gap of one
 * border-width.
 */
export function fitRoundedBorderDash(perimeter: number, width: number, style: "dashed" | "dotted"): { array: number[]; offset: number } {
  if (style === "dotted") {
    // The dot is a round CAP, not the dash itself: the array's dash length
    // must stay near-zero (matching the sharp-corner dotted branch's own
    // convention) or a round-capped stroke of length `width` would render
    // as an elongated stadium, not a circle. Only the GAP scales to hit the
    // target period (dot diameter + matching gap = 2x width), chosen so N
    // whole periods tile the perimeter exactly and the pattern closes onto
    // itself with no seam at the path's start point.
    const nearZeroDash = width * 0.01;
    const targetPeriod = width * 2;
    const count = Math.max(1, Math.round(perimeter / targetPeriod));
    const period = perimeter / count;
    return { array: [nearZeroDash, Math.max(0, period - nearZeroDash)], offset: 0 };
  }
  const unit = width * 2;
  const period = Math.max(unit + width, 1e-6);
  const count = Math.max(1, Math.round(perimeter / period));
  const gap = Math.max(0, (perimeter - count * unit) / count);
  return { array: [unit, gap], offset: 0 };
}
