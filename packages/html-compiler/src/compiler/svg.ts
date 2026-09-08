import { fail } from "./errors";
import type { Node } from "./model";

function attributeNumber(node: Node, name: string, fallback?: number): number {
  const raw = node.attributes.get(name);
  if (raw === undefined || raw.trim() === "") {
    if (fallback !== undefined) return fallback;
    fail("svg-attribute-missing", `<${node.tag}> requires ${name}`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) fail("svg-attribute-invalid", `<${node.tag}> ${name} must be a finite number: ${raw}`);
  return value;
}

function roundedRectPath(x: number, y: number, width: number, height: number, rx: number, ry: number): string {
  if (rx === 0 && ry === 0) return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
  const k = 0.5522847498;
  return [
    `M ${x + rx} ${y}`,
    `H ${x + width - rx}`,
    `C ${x + width - rx + k * rx} ${y} ${x + width} ${y + ry - k * ry} ${x + width} ${y + ry}`,
    `V ${y + height - ry}`,
    `C ${x + width} ${y + height - ry + k * ry} ${x + width - rx + k * rx} ${y + height} ${x + width - rx} ${y + height}`,
    `H ${x + rx}`,
    `C ${x + rx - k * rx} ${y + height} ${x} ${y + height - ry + k * ry} ${x} ${y + height - ry}`,
    `V ${y + ry}`,
    `C ${x} ${y + ry - k * ry} ${x + rx - k * rx} ${y} ${x + rx} ${y}`,
    "Z",
  ].join(" ");
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5522847498;
  return [
    `M ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + k * ry} ${cx + k * rx} ${cy + ry} ${cx} ${cy + ry}`,
    `C ${cx - k * rx} ${cy + ry} ${cx - rx} ${cy + k * ry} ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - k * ry} ${cx - k * rx} ${cy - ry} ${cx} ${cy - ry}`,
    `C ${cx + k * rx} ${cy - ry} ${cx + rx} ${cy - k * ry} ${cx + rx} ${cy}`,
    "Z",
  ].join(" ");
}

function points(node: Node): Array<{ x: number; y: number }> {
  const raw = node.attributes.get("points")?.trim() ?? "";
  const values = raw.split(/[\s,]+/).filter(Boolean).map(Number);
  if (values.length < 4 || values.length % 2 !== 0 || values.some((value) => !Number.isFinite(value))) {
    fail("svg-points-invalid", `<${node.tag}> points must contain finite x/y pairs`);
  }
  return Array.from({ length: values.length / 2 }, (_, index) => ({ x: values[index * 2]!, y: values[index * 2 + 1]! }));
}

/** Convert common SVG primitives into the canonical path grammar. */
export function svgPrimitivePath(node: Node): string | undefined {
  if (node.tag === "rect") {
    const x = attributeNumber(node, "x", 0);
    const y = attributeNumber(node, "y", 0);
    const width = attributeNumber(node, "width");
    const height = attributeNumber(node, "height");
    if (width < 0 || height < 0) fail("svg-geometry-invalid", "SVG rect width and height must be non-negative");
    const rawRx = node.attributes.get("rx");
    const rawRy = node.attributes.get("ry");
    const rx = Math.min(width / 2, Math.max(0, rawRx === undefined ? (rawRy === undefined ? 0 : attributeNumber(node, "ry")) : attributeNumber(node, "rx")));
    const ry = Math.min(height / 2, Math.max(0, rawRy === undefined ? rx : attributeNumber(node, "ry")));
    return roundedRectPath(x, y, width, height, rx, ry);
  }
  if (node.tag === "circle") {
    const radius = attributeNumber(node, "r");
    if (radius < 0) fail("svg-geometry-invalid", "SVG circle r must be non-negative");
    return ellipsePath(attributeNumber(node, "cx", 0), attributeNumber(node, "cy", 0), radius, radius);
  }
  if (node.tag === "ellipse") {
    const rx = attributeNumber(node, "rx");
    const ry = attributeNumber(node, "ry");
    if (rx < 0 || ry < 0) fail("svg-geometry-invalid", "SVG ellipse radii must be non-negative");
    return ellipsePath(attributeNumber(node, "cx", 0), attributeNumber(node, "cy", 0), rx, ry);
  }
  if (node.tag === "line") return `M ${attributeNumber(node, "x1", 0)} ${attributeNumber(node, "y1", 0)} L ${attributeNumber(node, "x2", 0)} ${attributeNumber(node, "y2", 0)}`;
  if (node.tag === "polyline" || node.tag === "polygon") {
    const values = points(node);
    if (node.tag === "polygon" && values.length < 3) fail("svg-points-invalid", "SVG polygon requires at least three points");
    return `M ${values.map((point) => `${point.x} ${point.y}`).join(" L ")}${node.tag === "polygon" ? " Z" : ""}`;
  }
  return undefined;
}
