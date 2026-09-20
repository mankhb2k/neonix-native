/**
 * Literal-geometry dash/dot runs for a ROUNDED border, replacing a runtime
 * strokeDash cycled around one closed bezier path.
 *
 * Isolated via apps/web/public/docs/html-compiler/fixtures/debug/
 * svg-rounded-rect-dash-isolation.html (a plain SVG <rect rx> +
 * stroke-dasharray, no border-lowering involved at all): CanvasKit's
 * SkPathEffect::MakeDash reproducibly drops/corrupts one dash exactly at a
 * line-to-cubic verb transition on a closed rounded-rect path, regardless of
 * whether the dash array/count is hand-computed to close perfectly (with or
 * without an explicit `pathLength` calibration). This is a CanvasKit/Skia
 * dash-effect rendering bug, not a value bug in fitRoundedBorderDash's
 * count/gap formula (which independently matches the browser closely where
 * the effect doesn't corrupt it). The fix is architectural, mirroring the
 * sharp-corner (no-radius) border's approach: compute every dash/dot run's
 * exact literal geometry at compile time and hand CanvasKit (and later
 * native) pre-baked sub-paths with a *plain* solid stroke -- no runtime
 * PathEffect involved, so the bug has nothing to attach to.
 */

import type { HtmlPathContour } from "../shape-contours";
import type { HtmlPoint } from "./geometry";

type CornerRadii = { topLeft: { rx: number; ry: number }; topRight: { rx: number; ry: number }; bottomRight: { rx: number; ry: number }; bottomLeft: { rx: number; ry: number } };

type LinePiece = { kind: "line"; from: HtmlPoint; to: HtmlPoint; length: number };
type ArcPiece = { kind: "arc"; center: HtmlPoint; rx: number; ry: number; startAngle: number; endAngle: number; length: number };
type Piece = LinePiece | ArcPiece;

const EPSILON = 1e-6;

function ellipseSpeed(rx: number, ry: number, angle: number): number {
  return Math.hypot(rx * Math.sin(angle), ry * Math.cos(angle));
}

/** Simpson's rule; exact for the circular case (rx === ry) and a very close approximation otherwise. */
function ellipseArcLength(rx: number, ry: number, a0: number, a1: number, steps = 64): number {
  if (Math.abs(a1 - a0) <= EPSILON) return 0;
  const h = (a1 - a0) / steps;
  let sum = ellipseSpeed(rx, ry, a0) + ellipseSpeed(rx, ry, a1);
  for (let i = 1; i < steps; i += 1) sum += ellipseSpeed(rx, ry, a0 + i * h) * (i % 2 === 0 ? 2 : 4);
  return (sum * h) / 3;
}

function angleAtArcLength(rx: number, ry: number, a0: number, a1: number, targetLength: number): number {
  let lo = a0;
  let hi = a1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (ellipseArcLength(rx, ry, a0, mid) < targetLength) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function pointOnEllipse(center: HtmlPoint, rx: number, ry: number, angle: number): HtmlPoint {
  return { x: center.x + rx * Math.cos(angle), y: center.y + ry * Math.sin(angle) };
}

function ellipseArcBezier(center: HtmlPoint, rx: number, ry: number, a0: number, a1: number): { control1: HtmlPoint; control2: HtmlPoint; to: HtmlPoint } {
  const alpha = (4 / 3) * Math.tan((a1 - a0) / 4);
  const p0 = pointOnEllipse(center, rx, ry, a0);
  const p3 = pointOnEllipse(center, rx, ry, a1);
  const tangent0 = { x: -rx * Math.sin(a0), y: ry * Math.cos(a0) };
  const tangent1 = { x: -rx * Math.sin(a1), y: ry * Math.cos(a1) };
  return {
    control1: { x: p0.x + alpha * tangent0.x, y: p0.y + alpha * tangent0.y },
    control2: { x: p3.x - alpha * tangent1.x, y: p3.y - alpha * tangent1.y },
    to: p3,
  };
}

/** Same corner order/geometry as shape-contours.ts's roundedRectContour, decomposed into exact-length pieces for arc-length slicing. */
function buildPerimeterPieces(width: number, height: number, radius: CornerRadii): Piece[] {
  const { topLeft, topRight, bottomRight, bottomLeft } = radius;
  const raw: Array<
    | { kind: "line"; from: HtmlPoint; to: HtmlPoint }
    | { kind: "arc"; center: HtmlPoint; rx: number; ry: number; startAngle: number; endAngle: number }
  > = [
    { kind: "line", from: { x: topLeft.rx, y: 0 }, to: { x: width - topRight.rx, y: 0 } },
    { kind: "arc", center: { x: width - topRight.rx, y: topRight.ry }, rx: topRight.rx, ry: topRight.ry, startAngle: -Math.PI / 2, endAngle: 0 },
    { kind: "line", from: { x: width, y: topRight.ry }, to: { x: width, y: height - bottomRight.ry } },
    { kind: "arc", center: { x: width - bottomRight.rx, y: height - bottomRight.ry }, rx: bottomRight.rx, ry: bottomRight.ry, startAngle: 0, endAngle: Math.PI / 2 },
    { kind: "line", from: { x: width - bottomRight.rx, y: height }, to: { x: bottomLeft.rx, y: height } },
    { kind: "arc", center: { x: bottomLeft.rx, y: height - bottomLeft.ry }, rx: bottomLeft.rx, ry: bottomLeft.ry, startAngle: Math.PI / 2, endAngle: Math.PI },
    { kind: "line", from: { x: 0, y: height - bottomLeft.ry }, to: { x: 0, y: topLeft.ry } },
    { kind: "arc", center: { x: topLeft.rx, y: topLeft.ry }, rx: topLeft.rx, ry: topLeft.ry, startAngle: Math.PI, endAngle: (3 * Math.PI) / 2 },
  ];
  return raw
    .map((piece): Piece => piece.kind === "line"
      ? { ...piece, length: Math.hypot(piece.to.x - piece.from.x, piece.to.y - piece.from.y) }
      : { ...piece, length: ellipseArcLength(piece.rx, piece.ry, piece.startAngle, piece.endAngle) })
    .filter((piece) => piece.length > EPSILON);
}

export function roundedRectExactPerimeter(width: number, height: number, radius: CornerRadii): number {
  return buildPerimeterPieces(width, height, radius).reduce((sum, piece) => sum + piece.length, 0);
}

/**
 * Extracts the literal sub-path covering arc-length range [from, to) of the
 * closed perimeter (0 <= from < to <= perimeter, never wrapping -- callers
 * keep every run inside one lap). Segments falling fully or partially in
 * range are emitted as exact line or single-cubic-arc pieces.
 */
function sliceRun(pieces: readonly Piece[], from: number, to: number): HtmlPathContour {
  const segments: HtmlPathContour["segments"] = [];
  let start: HtmlPoint | undefined;
  let cursor = 0;
  for (const piece of pieces) {
    const pieceStart = cursor;
    const pieceEnd = cursor + piece.length;
    cursor = pieceEnd;
    if (pieceEnd <= from || pieceStart >= to) continue;
    const localFrom = Math.max(0, from - pieceStart);
    const localTo = Math.min(piece.length, to - pieceStart);
    if (piece.kind === "line") {
      const dir = { x: (piece.to.x - piece.from.x) / piece.length, y: (piece.to.y - piece.from.y) / piece.length };
      const a = { x: piece.from.x + dir.x * localFrom, y: piece.from.y + dir.y * localFrom };
      const b = { x: piece.from.x + dir.x * localTo, y: piece.from.y + dir.y * localTo };
      if (!start) start = a;
      segments.push({ kind: "line", to: b });
    } else {
      const angleFrom = localFrom <= EPSILON ? piece.startAngle : angleAtArcLength(piece.rx, piece.ry, piece.startAngle, piece.endAngle, localFrom);
      const angleTo = localTo >= piece.length - EPSILON ? piece.endAngle : angleAtArcLength(piece.rx, piece.ry, piece.startAngle, piece.endAngle, localTo);
      if (!start) start = pointOnEllipse(piece.center, piece.rx, piece.ry, angleFrom);
      const bezier = ellipseArcBezier(piece.center, piece.rx, piece.ry, angleFrom, angleTo);
      segments.push({ kind: "cubic", control1: bezier.control1, control2: bezier.control2, to: bezier.to });
    }
  }
  return { id: `rounded-dash-run:${from.toFixed(3)}`, start: start ?? { x: 0, y: 0 }, segments, closed: false };
}

/**
 * Faithful port of Blink's third_party/blink/renderer/platform/graphics/
 * styled_stroke_data.cc SelectBestDashGap: picks whichever of floor(N) or
 * floor(N)+1 dashes yields a gap closest to the target gap length (a closed
 * path has N gaps for N dashes; an open path has N-1). Pulled from the real
 * Chromium source (see D:\NextJS\chromium-reference) rather than reverse-
 * engineered from pixels, so this is the actual browser algorithm, not an
 * approximation of it.
 */
function selectBestDashPlan(strokeLength: number, dashLength: number, gapLength: number, closedPath: boolean): { count: number; gap: number } {
  const availableLength = closedPath ? strokeLength : strokeLength + gapLength;
  const minCount = Math.floor(availableLength / (dashLength + gapLength));
  const maxCount = minCount + 1;
  const minGaps = closedPath ? minCount : minCount - 1;
  const maxGaps = closedPath ? maxCount : maxCount - 1;
  const minGap = minGaps > 0 ? (strokeLength - minCount * dashLength) / minGaps : -Infinity;
  const maxGap = maxGaps > 0 ? (strokeLength - maxCount * dashLength) / maxGaps : -Infinity;
  return maxGap <= 0 || Math.abs(minGap - gapLength) < Math.abs(maxGap - gapLength)
    ? { count: minCount, gap: minGap }
    : { count: maxCount, gap: maxGap };
}

/**
 * DASHED: literal open sub-contours, one per visible dash -- pre-baked
 * geometry instead of a runtime strokeDash, so CanvasKit's closed-path
 * dash-effect bug (isolated via debug/svg-rounded-rect-dash-isolation.html)
 * has no path to attach to. Count/gap follow Blink's real DashEffectFrom
 * StrokeStyle for a closed path: dash length = 2x border-width, target gap
 * = border-width (both ratios are 1.0/2.0 only for width < 3px, which never
 * applies to a rounded border thick enough to see the radius on).
 */
export function buildRoundedDashRuns(width: number, height: number, radius: CornerRadii, borderWidth: number): HtmlPathContour[] {
  const pieces = buildPerimeterPieces(width, height, radius);
  const perimeter = pieces.reduce((sum, piece) => sum + piece.length, 0);
  const dashLength = borderWidth * 2;
  const gapLength = borderWidth;
  if (perimeter <= dashLength * 2) return [sliceRun(pieces, 0, perimeter)];
  // Closed-path "exactly 2 dashes" proportional fallback for a perimeter too
  // short to fit 2 full-size dashes + their gaps (matches DashEffectFrom
  // StrokeStyle's two_dashes_with_gap_length branch).
  const twoDashesWithGap = 2 * dashLength + 2 * gapLength;
  if (perimeter <= twoDashesWithGap) {
    const multiplier = perimeter / twoDashesWithGap;
    const runPeriod = (dashLength + gapLength) * multiplier;
    return [sliceRun(pieces, 0, dashLength * multiplier), sliceRun(pieces, runPeriod, runPeriod + dashLength * multiplier)];
  }
  const { count, gap } = selectBestDashPlan(perimeter, dashLength, gapLength, true);
  const runPeriod = dashLength + gap;
  return Array.from({ length: count }, (_, index) => sliceRun(pieces, index * runPeriod, index * runPeriod + dashLength));
}

/**
 * DOTTED: each dot is its own near-zero-length literal segment with a round
 * cap (same "round cap on a near-zero dash" trick as the sharp-corner case),
 * placed at an exact perimeter position per Blink's real dotted-stroke
 * algorithm (target period = 2x border-width, closed-path gap selection).
 */
export function buildRoundedDotRuns(width: number, height: number, radius: CornerRadii, borderWidth: number): HtmlPathContour[] {
  const pieces = buildPerimeterPieces(width, height, radius);
  const perimeter = pieces.reduce((sum, piece) => sum + piece.length, 0);
  const perDotLength = borderWidth * 2;
  const nearZero = Math.min(borderWidth * 0.01, perimeter / 4);
  if (perimeter < perDotLength) return [sliceRun(pieces, 0, nearZero)];
  const { count, gap } = selectBestDashPlan(perimeter, borderWidth, borderWidth, true);
  const period = borderWidth + gap;
  return Array.from({ length: count }, (_, index) => sliceRun(pieces, index * period, index * period + nearZero));
}
