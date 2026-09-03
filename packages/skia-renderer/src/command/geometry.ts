import type { PaintCommand } from "@motionvideo/motion-runtime";
import type { DrawBounds } from "./types";

export function pathSvg(command: Extract<PaintCommand, { op: "drawPath" }>): string {
  return command.contours.map((contour) => {
    let d = `M ${contour.start.x} ${contour.start.y}`;
    for (const segment of contour.segments) {
      if (segment.kind === "line") d += ` L ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "quadratic") d += ` Q ${segment.control.x} ${segment.control.y} ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "cubic") d += ` C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.to.x} ${segment.to.y}`;
      else if (segment.kind === "arc") d += ` A ${segment.radii.x} ${segment.radii.y} ${segment.rotation} ${segment.largeArc ? 1 : 0} ${segment.sweep ? 1 : 0} ${segment.to.x} ${segment.to.y}`;
    }
    return contour.closed ? `${d} Z` : d;
  }).join(" ");
}

export function polygonSvg(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`;
}

export function matrix4ToSkia3x3(matrix: readonly number[]): number[] {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) throw new Error("Skia requires a finite Matrix4");
  const [a, b, , , c, d, , , , , , , e, f] = matrix;
  return [a!, c!, e!, b!, d!, f!, 0, 0, 1];
}

export function unionBounds(current: DrawBounds | undefined, next: DrawBounds): DrawBounds {
  if (!current) return next;
  return {
    left: Math.min(current.left, next.left),
    top: Math.min(current.top, next.top),
    right: Math.max(current.right, next.right),
    bottom: Math.max(current.bottom, next.bottom),
  };
}

export function drawCommandBounds(command: PaintCommand, transform: Extract<PaintCommand, { op: "setTransform" }> | null): DrawBounds | undefined {
  let x = 0;
  let y = 0;
  let width = 0;
  let height = 0;
  if (command.op === "drawSolid" || command.op === "drawShape" || command.op === "drawText" || command.op === "drawPath") {
    width = command.width ?? 0;
    height = command.height ?? 0;
  } else if (command.op === "drawImage") {
    x = command.x;
    y = command.y;
    width = command.width;
    height = command.height;
  } else if (command.op === "drawVideo") {
    width = command.width;
    height = command.height;
  } else {
    return undefined;
  }
  if (!(width > 0 && height > 0) || (transform && (!transform.visible || transform.alpha <= 0))) return undefined;
  const [a, c, e, b, d, f] = transform ? matrix4ToSkia3x3(transform.matrix4) : [1, 0, 0, 0, 1, 0];
  const points = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(([px, py]) => ({ x: a! * px + c! * py + e!, y: b! * px + d! * py + f! }));
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}
