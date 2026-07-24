import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";

import type { Transform2D } from "./matrix";
import type { Bounds2D } from "./spatial";

type RuntimeNode = NormalizedMotionProjectV2["scenes"][number]["nodes"][number];
type Point = { x: number; y: number };

function pointBounds(points: Point[]): Bounds2D {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function mergeBounds(left: Bounds2D, right: Bounds2D): Bounds2D {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function cubicValue(start: number, control1: number, control2: number, end: number, time: number): number {
  const inverse = 1 - time;
  return inverse ** 3 * start
    + 3 * inverse ** 2 * time * control1
    + 3 * inverse * time ** 2 * control2
    + time ** 3 * end;
}

function cubicExtrema(start: number, control1: number, control2: number, end: number): number[] {
  const a = -start + 3 * control1 - 3 * control2 + end;
  const b = 2 * (start - 2 * control1 + control2);
  const c = control1 - start;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return [];
    const time = -c / b;
    return time > 0 && time < 1 ? [time] : [];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  return [(-b + root) / (2 * a), (-b - root) / (2 * a)].filter((time) => time > 0 && time < 1);
}

export function cubicBezierBounds(start: Point, control1: Point, control2: Point, end: Point): Bounds2D {
  const times = new Set([
    0,
    1,
    ...cubicExtrema(start.x, control1.x, control2.x, end.x),
    ...cubicExtrema(start.y, control1.y, control2.y, end.y),
  ]);
  return pointBounds([...times].map((time) => ({
    x: cubicValue(start.x, control1.x, control2.x, end.x, time),
    y: cubicValue(start.y, control1.y, control2.y, end.y, time),
  })));
}

function pathBounds(node: Extract<RuntimeNode, { type: "path" }>): Bounds2D {
  const contourBounds = node.payload.contours.map((contour) => {
    let current = contour.start;
    let bounds: Bounds2D = { x: current.x, y: current.y, width: 0, height: 0 };
    for (const segment of contour.segments) {
      const next = segment.to;
      const segmentBounds = segment.kind === "cubic"
        ? cubicBezierBounds(current, segment.control1, segment.control2, next)
        : pointBounds([current, next]);
      bounds = mergeBounds(bounds, segmentBounds);
      current = next;
    }
    if (contour.closed) bounds = mergeBounds(bounds, pointBounds([current, contour.start]));
    return bounds;
  });
  return contourBounds.slice(1).reduce((bounds, next) => mergeBounds(bounds, next), contourBounds[0]!);
}

export function inflateBounds(bounds: Bounds2D, amount: number): Bounds2D {
  if (amount <= 0) return bounds;
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  };
}

/** Returns canonical local-space drawable bounds, including half of the evaluated stroke. */
export function localNodeBounds(node: RuntimeNode, transform: Transform2D, strokeWidth = 0): Bounds2D {
  let bounds: Bounds2D = { x: 0, y: 0, width: transform.width, height: transform.height };
  if (node.type === "shape" && node.payload.shape === "polygon") bounds = pointBounds(node.payload.points);
  else if (node.type === "path") bounds = pathBounds(node);
  return inflateBounds(bounds, strokeWidth / 2);
}
