import type { PathPoint, PathStrokeCap } from "./types";
import { add2, appendArc, leftNormal, scale2 } from "./joins";

export function capExtension(direction: PathPoint, halfWidth: number, cap: PathStrokeCap, atStart: boolean): PathPoint {
  return cap === "square" ? scale2(direction, atStart ? -halfWidth : halfWidth) : { x: 0, y: 0 };
}

export function appendRoundCap(vertices: number[], indices: number[], point: PathPoint, direction: PathPoint, halfWidth: number, cap: PathStrokeCap, atStart: boolean): void {
  if (cap !== "round") return;
  const normal = scale2(leftNormal(direction), halfWidth);
  appendArc(vertices, indices, point, add2(point, normal), add2(point, scale2(normal, -1)), atStart ? 1 : -1, halfWidth);
}
