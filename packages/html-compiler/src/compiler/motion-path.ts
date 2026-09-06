import type { V2MotionPath, V2PathSegment, V2PathPoint } from "@motionvideo/motion-protocol/v2";
import { fail } from "./errors";
import { parseSvgPathData } from "./path";
import { calcExpression } from "./values";
import type { Style } from "./model";

type Viewport = { width: number; height: number };

function pointOnSegment(start: V2PathPoint, segment: V2PathSegment, t: number): V2PathPoint {
  const amount = Math.max(0, Math.min(1, t));
  if (segment.kind === "line") return { x: start.x + (segment.to.x - start.x) * amount, y: start.y + (segment.to.y - start.y) * amount };
  if (segment.kind === "quadratic") {
    const u = 1 - amount;
    return { x: u * u * start.x + 2 * u * amount * segment.control.x + amount * amount * segment.to.x, y: u * u * start.y + 2 * u * amount * segment.control.y + amount * amount * segment.to.y };
  }
  if (segment.kind === "cubic") {
    const u = 1 - amount;
    return { x: u ** 3 * start.x + 3 * u * u * amount * segment.control1.x + 3 * u * amount * amount * segment.control2.x + amount ** 3 * segment.to.x, y: u ** 3 * start.y + 3 * u * u * amount * segment.control1.y + 3 * u * amount * amount * segment.control2.y + amount ** 3 * segment.to.y };
  }
  // SVG arc length is resolved by the runtime flattener. A dense chord
  // estimate here is used only to resolve CSS percentages into the canonical
  // normalized distance stored in V2.
  return { x: start.x + (segment.to.x - start.x) * amount, y: start.y + (segment.to.y - start.y) * amount };
}

function segmentLength(start: V2PathPoint, segment: V2PathSegment): number {
  const steps = segment.kind === "line" ? 1 : segment.kind === "arc" ? 64 : 32;
  let total = 0;
  let previous = start;
  for (let index = 1; index <= steps; index += 1) {
    const current = pointOnSegment(start, segment, index / steps);
    total += Math.hypot(current.x - previous.x, current.y - previous.y);
    previous = current;
  }
  return total;
}

export function motionPathLength(contours: readonly { start: V2PathPoint; segments: V2PathSegment[]; closed: boolean }[]): number {
  const contour = contours[0];
  if (!contour) return 0;
  let total = 0;
  let start = contour.start;
  for (const segment of contour.segments) {
    total += segmentLength(start, segment);
    start = segment.to;
  }
  if (contour.closed) total += Math.hypot(start.x - contour.start.x, start.y - contour.start.y);
  return total;
}

function angle(value: string, property: string): number {
  const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(deg|rad|turn)$/i);
  if (!match) { fail("css-motion-rotate-invalid", `${property} requires an angle: ${value}`); throw new Error("unreachable motion angle"); }
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  return unit === "rad" ? (amount * 180) / Math.PI : unit === "turn" ? amount * 360 : amount;
}

function length(value: string, property: string, relative: number, fontSize: number, viewport: Viewport): number {
  const resolved = calcExpression(value, property, relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(resolved)) fail("css-motion-anchor-invalid", `${property} requires a finite length: ${value}`);
  return resolved;
}

function anchorValue(value: string, property: "x" | "y", width: number, height: number, fontSize: number, viewport: Viewport): number {
  const keywords = property === "x" ? { left: "0%", center: "50%", right: "100%" } : { top: "0%", center: "50%", bottom: "100%" };
  return length(keywords[value.trim().toLowerCase() as keyof typeof keywords] ?? value, `offset-anchor.${property}`, property === "x" ? width : height, fontSize, viewport);
}

function parseAnchor(value: string | undefined, width: number, height: number, fontSize: number, viewport: Viewport): { x: number; y: number } {
  if (!value || value.trim().toLowerCase() === "auto") return { x: width / 2, y: height / 2 };
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 2) fail("css-motion-anchor-invalid", `offset-anchor expects one or two values: ${value}`);
  return { x: anchorValue(tokens[0]!, "x", width, height, fontSize, viewport), y: anchorValue(tokens[1] ?? "center", "y", width, height, fontSize, viewport) };
}

function parseRotate(value: string | undefined): V2MotionPath["offsetRotate"] {
  const source = (value ?? "auto").trim().toLowerCase();
  if (source === "auto") return { mode: "auto", angle: 0 };
  if (source === "reverse" || source === "auto-reverse") return { mode: "auto-reverse", angle: 0 };
  const tokens = source.split(/\s+/).filter(Boolean);
  if (tokens.length === 2 && (tokens[0] === "auto" || tokens[0] === "reverse" || tokens[0] === "auto-reverse")) {
    return { mode: tokens[0] === "auto" ? "auto" : "auto-reverse", angle: angle(tokens[1]!, "offset-rotate") };
  }
  if (tokens.length !== 1) fail("css-motion-rotate-invalid", `Unsupported offset-rotate value: ${value}`);
  return { mode: "fixed", angle: angle(tokens[0]!, "offset-rotate") };
}

export function parseMotionPath(style: Style, width: number, height: number, fontSize: number, viewport: Viewport): V2MotionPath | undefined {
  const source = style.get("offset-path")?.trim();
  if (!source || source.toLowerCase() === "none") return undefined;
  const match = source.match(/^path\(\s*(?:"([\s\S]*)"|'([\s\S]*)')\s*\)$/i);
  if (!match) { fail("css-motion-path-unsupported", `Only offset-path: path(\"...\") is supported: ${source}`); throw new Error("unreachable motion path"); }
  const contours = parseSvgPathData(match[1] ?? match[2] ?? "", "offset-path");
  if (contours.length !== 1) fail("css-motion-path-multiple-contours", "offset-path currently requires exactly one path contour");
  const pathLength = motionPathLength(contours);
  if (!(pathLength > 0)) fail("css-motion-path-zero-length", "offset-path must have a positive length");
  return {
    offsetPath: {
      type: "path",
      contours,
      coordinateSpace: "parent-local",
      referenceBox: "border-box",
      pathLength,
      sampling: { method: "adaptive-flatness", tolerance: 0.25, maxSegments: 4096 },
    },
    offsetDistance: 0,
    offsetRotate: parseRotate(style.get("offset-rotate")),
    offsetAnchor: parseAnchor(style.get("offset-anchor"), width, height, fontSize, viewport),
  };
}
