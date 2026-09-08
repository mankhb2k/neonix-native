import type { V2SvgDefinitionNode, V2PathContour } from "@motionvideo/motion-protocol/v2";
import { fail } from "./errors";
import { calcExpression } from "./values";
import { splitTopLevel } from "./utils";
import { parseSvgPathData } from "./path";

export type ClipReferenceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClipReferenceBoxes = {
  borderBox: ClipReferenceBox;
  paddingBox: ClipReferenceBox;
  contentBox: ClipReferenceBox;
};

export type HtmlClipPathNode = Extract<V2SvgDefinitionNode, { type: "path" }>;

function finiteLength(value: string, property: string, relative: number, nonNegative = false): number {
  const resolved = calcExpression(value, property, relative, 16, 16, { width: 1920, height: 1080 }).value;
  if (!Number.isFinite(resolved) || (nonNegative && resolved < 0)) {
    fail("css-clip-path-value-invalid", `${property} must resolve to ${nonNegative ? "a non-negative " : "a finite "}length: ${value}`);
  }
  return resolved;
}

function splitTopLevelKeyword(input: string, keyword: string): [string, string | undefined] {
  let depth = 0;
  for (let index = 0; index <= input.length - keyword.length; index += 1) {
    const character = input[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    if (depth !== 0) continue;
    const candidate = input.slice(index, index + keyword.length);
    const before = index === 0 ? " " : input[index - 1]!;
    const after = index + keyword.length === input.length ? " " : input[index + keyword.length]!;
    if (candidate.toLowerCase() === keyword && /\s/.test(before) && /\s/.test(after)) {
      return [input.slice(0, index).trim(), input.slice(index + keyword.length).trim()];
    }
  }
  return [input.trim(), undefined];
}

function quad(value: string, property: string): [string, string, string, string] {
  const values = splitTopLevel(value, " ");
  if (values.length < 1 || values.length > 4) fail("css-clip-path-invalid", `${property} expects one to four values: ${value}`);
  if (values.length === 1) return [values[0]!, values[0]!, values[0]!, values[0]!];
  if (values.length === 2) return [values[0]!, values[1]!, values[0]!, values[1]!];
  if (values.length === 3) return [values[0]!, values[1]!, values[2]!, values[1]!];
  return [values[0]!, values[1]!, values[2]!, values[3]!];
}

function rectangleContour(box: ClipReferenceBox, id: string): HtmlClipPathNode {
  return {
    type: "path",
    contours: [{
      id,
      start: { x: box.x, y: box.y },
      segments: [
        { kind: "line", to: { x: box.x + box.width, y: box.y } },
        { kind: "line", to: { x: box.x + box.width, y: box.y + box.height } },
        { kind: "line", to: { x: box.x, y: box.y + box.height } },
      ],
      closed: true,
    }],
    fillRule: "nonzero",
  };
}

function roundedRectangleContour(box: ClipReferenceBox, radii: { topLeft: { rx: number; ry: number }; topRight: { rx: number; ry: number }; bottomRight: { rx: number; ry: number }; bottomLeft: { rx: number; ry: number } }, id: string): HtmlClipPathNode {
  return {
    type: "path",
    contours: [{
      id,
      start: { x: box.x + radii.topLeft.rx, y: box.y },
      segments: [
        { kind: "line", to: { x: box.x + box.width - radii.topRight.rx, y: box.y } },
        { kind: "arc", radii: { x: radii.topRight.rx, y: radii.topRight.ry }, rotation: 0, largeArc: false, sweep: true, to: { x: box.x + box.width, y: box.y + radii.topRight.ry } },
        { kind: "line", to: { x: box.x + box.width, y: box.y + box.height - radii.bottomRight.ry } },
        { kind: "arc", radii: { x: radii.bottomRight.rx, y: radii.bottomRight.ry }, rotation: 0, largeArc: false, sweep: true, to: { x: box.x + box.width - radii.bottomRight.rx, y: box.y + box.height } },
        { kind: "line", to: { x: box.x + radii.bottomLeft.rx, y: box.y + box.height } },
        { kind: "arc", radii: { x: radii.bottomLeft.rx, y: radii.bottomLeft.ry }, rotation: 0, largeArc: false, sweep: true, to: { x: box.x, y: box.y + box.height - radii.bottomLeft.ry } },
        { kind: "line", to: { x: box.x, y: box.y + radii.topLeft.ry } },
        { kind: "arc", radii: { x: radii.topLeft.rx, y: radii.topLeft.ry }, rotation: 0, largeArc: false, sweep: true, to: { x: box.x + radii.topLeft.rx, y: box.y } },
      ],
      closed: true,
    }],
    fillRule: "nonzero",
  };
}

function scaleRadii(box: ClipReferenceBox, horizontal: [number, number, number, number], vertical: [number, number, number, number]) {
  const scale = Math.min(
    1,
    box.width / Math.max(1e-9, horizontal[0]! + horizontal[1]!),
    box.width / Math.max(1e-9, horizontal[2]! + horizontal[3]!),
    box.height / Math.max(1e-9, vertical[0]! + vertical[3]!),
    box.height / Math.max(1e-9, vertical[1]! + vertical[2]!),
  );
  return {
    topLeft: { rx: horizontal[0]! * scale, ry: vertical[0]! * scale },
    topRight: { rx: horizontal[1]! * scale, ry: vertical[1]! * scale },
    bottomRight: { rx: horizontal[2]! * scale, ry: vertical[2]! * scale },
    bottomLeft: { rx: horizontal[3]! * scale, ry: vertical[3]! * scale },
  };
}

function parsePosition(value: string | undefined, box: ClipReferenceBox): { x: number; y: number } {
  if (value === undefined) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const values = splitTopLevel(value, " ");
  if (values.length < 1 || values.length > 2) fail("css-clip-path-position-invalid", `Invalid clip-path position: ${value}`);
  const xValue = values[0]!;
  const yValue = values[1] ?? "50%";
  const x = xValue.toLowerCase() === "left" ? 0 : xValue.toLowerCase() === "center" ? box.width / 2 : xValue.toLowerCase() === "right" ? box.width : finiteLength(xValue, "clip-path position-x", box.width);
  const y = yValue.toLowerCase() === "top" ? 0 : yValue.toLowerCase() === "center" ? box.height / 2 : yValue.toLowerCase() === "bottom" ? box.height : finiteLength(yValue, "clip-path position-y", box.height);
  return { x: box.x + x, y: box.y + y };
}

function radialRadius(value: string | undefined, box: ClipReferenceBox, center: { x: number; y: number }, axis: "x" | "y"): number {
  const distances = axis === "x" ? [center.x - box.x, box.x + box.width - center.x] : [center.y - box.y, box.y + box.height - center.y];
  if (value === undefined) return Math.min(...distances);
  const keyword = value.toLowerCase();
  if (keyword === "closest-side") return Math.min(...distances);
  if (keyword === "farthest-side") return Math.max(...distances);
  return finiteLength(value, `clip-path ${axis}-radius`, axis === "x" ? box.width : box.height, true);
}

function cornerRadius(value: string, center: { x: number; y: number }, box: ClipReferenceBox, farthest: boolean): number {
  const corners = [
    Math.hypot(center.x - box.x, center.y - box.y),
    Math.hypot(center.x - (box.x + box.width), center.y - box.y),
    Math.hypot(center.x - (box.x + box.width), center.y - (box.y + box.height)),
    Math.hypot(center.x - box.x, center.y - (box.y + box.height)),
  ];
  return farthest ? Math.max(...corners) : Math.min(...corners);
}

function parseInset(body: string, box: ClipReferenceBox, id: string): HtmlClipPathNode {
  const [insetValue, roundValue] = splitTopLevelKeyword(body, "round");
  const insets = quad(insetValue, "clip-path inset()");
  const top = finiteLength(insets[0]!, "clip-path inset-top", box.height);
  const right = finiteLength(insets[1]!, "clip-path inset-right", box.width);
  const bottom = finiteLength(insets[2]!, "clip-path inset-bottom", box.height);
  const left = finiteLength(insets[3]!, "clip-path inset-left", box.width);
  const target = { x: box.x + left, y: box.y + top, width: Math.max(0, box.width - left - right), height: Math.max(0, box.height - top - bottom) };
  if (!roundValue) return rectangleContour(target, id);
  const [horizontalValue, verticalValue] = splitTopLevel(roundValue, "/");
  const horizontal = quad(horizontalValue!, "clip-path inset() round").map((value) => finiteLength(value, "clip-path radius-x", box.width, true)) as [number, number, number, number];
  const vertical = quad(verticalValue ?? horizontalValue!, "clip-path inset() round").map((value) => finiteLength(value, "clip-path radius-y", box.height, true)) as [number, number, number, number];
  return roundedRectangleContour(target, scaleRadii(target, horizontal, vertical), id);
}

function parseRadial(name: "circle" | "ellipse", body: string, box: ClipReferenceBox, id: string): HtmlClipPathNode {
  const [sizeValue, positionValue] = splitTopLevelKeyword(body, "at");
  const center = parsePosition(positionValue, box);
  const sizes = splitTopLevel(sizeValue, " ");
  if (name === "circle") {
    const radiusValue = sizes[0];
    const radius = radiusValue?.toLowerCase() === "closest-corner" || radiusValue?.toLowerCase() === "farthest-corner"
      ? cornerRadius(radiusValue, center, box, radiusValue.toLowerCase() === "farthest-corner")
      : radialRadius(radiusValue, box, center, "x");
    return {
      type: "path",
      contours: [{ id, start: { x: center.x + radius, y: center.y }, segments: [
        { kind: "arc", radii: { x: radius, y: radius }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x, y: center.y + radius } },
        { kind: "arc", radii: { x: radius, y: radius }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x - radius, y: center.y } },
        { kind: "arc", radii: { x: radius, y: radius }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x, y: center.y - radius } },
        { kind: "arc", radii: { x: radius, y: radius }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x + radius, y: center.y } },
      ], closed: true }],
      fillRule: "nonzero",
    };
  }
  if (sizes.length < 1 || sizes.length > 2) fail("css-clip-path-ellipse-invalid", `ellipse() expects one or two radii: ${body}`);
  const rx = radialRadius(sizes[0], box, center, "x");
  const ry = radialRadius(sizes[1] ?? sizes[0], box, center, "y");
  return {
    type: "path",
    contours: [{ id, start: { x: center.x + rx, y: center.y }, segments: [
      { kind: "arc", radii: { x: rx, y: ry }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x, y: center.y + ry } },
      { kind: "arc", radii: { x: rx, y: ry }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x - rx, y: center.y } },
      { kind: "arc", radii: { x: rx, y: ry }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x, y: center.y - ry } },
      { kind: "arc", radii: { x: rx, y: ry }, rotation: 0, largeArc: false, sweep: true, to: { x: center.x + rx, y: center.y } },
    ], closed: true }],
    fillRule: "nonzero",
  };
}

function parsePolygon(body: string, box: ClipReferenceBox, id: string): HtmlClipPathNode {
  const parts = splitTopLevel(body, ",");
  let fillRule: "nonzero" | "evenodd" = "nonzero";
  if (parts[0] === "nonzero" || parts[0] === "evenodd") {
    fillRule = parts.shift() as "nonzero" | "evenodd";
  }
  if (parts.length < 3) fail("css-clip-path-polygon-invalid", "polygon() requires at least three points");
  const points = parts.map((part) => {
    const values = splitTopLevel(part, " ");
    if (values.length !== 2) fail("css-clip-path-polygon-invalid", `Each polygon point requires x and y: ${part}`);
    return { x: finiteLength(values[0]!, "clip-path polygon-x", box.width) + box.x, y: finiteLength(values[1]!, "clip-path polygon-y", box.height) + box.y };
  });
  return { type: "path", contours: [{ id, start: points[0]!, segments: points.slice(1).map((to) => ({ kind: "line" as const, to })), closed: true }], fillRule };
}

function parsePath(body: string, _id: string): HtmlClipPathNode {
  let fillRule: "nonzero" | "evenodd" = "nonzero";
  const fillRulePrefix = body.match(/^(nonzero|evenodd)\s*,\s*/i);
  if (fillRulePrefix) fillRule = fillRulePrefix[1]!.toLowerCase() as "nonzero" | "evenodd";
  const value = fillRulePrefix ? body.slice(fillRulePrefix[0].length).trim() : body.trim();
  const quote = value[0];
  if ((quote !== "\"" && quote !== "'") || value[value.length - 1] !== quote) fail("css-clip-path-path-invalid", "path() requires a quoted SVG path string");
  const data = value.slice(1, -1).replace(/\\([\\"'])/g, "$1");
  const contours = parseSvgPathData(data, "clip-path path()") as V2PathContour[];
  if (contours.some((contour) => !contour.closed)) fail("css-clip-path-path-open", "clip-path path() must contain closed contours");
  return { type: "path", contours, fillRule };
}

function functionParts(value: string): { name: string; body: string; tail: string } {
  const match = value.match(/^([a-z-]+)\(/i);
  if (!match) return fail("css-clip-path-invalid", `Unsupported clip-path: ${value}`);
  let depth = 1;
  let index = match[0].length;
  while (index < value.length && depth > 0) {
    if (value[index] === "(") depth += 1;
    else if (value[index] === ")") depth -= 1;
    index += 1;
  }
  if (depth !== 0) return fail("css-clip-path-invalid", `Unclosed clip-path function: ${value}`);
  return { name: match[1]!.toLowerCase(), body: value.slice(match[0].length, index - 1).trim(), tail: value.slice(index).trim() };
}

export function parseClipPath(value: string | undefined, boxes: ClipReferenceBoxes): HtmlClipPathNode | undefined {
  if (value === undefined || value.trim().toLowerCase() === "none") return undefined;
  const { name, body, tail } = functionParts(value.trim());
  const boxName = tail || "border-box";
  const reference = boxName === "border-box" ? boxes.borderBox : boxName === "padding-box" ? boxes.paddingBox : boxName === "content-box" ? boxes.contentBox : undefined;
  if (!reference) return fail("css-clip-path-box-unsupported", `Unsupported clip-path reference box: ${boxName}`);
  const id = "html-clip-shape";
  if (name === "inset") return parseInset(body, reference, id);
  if (name === "circle" || name === "ellipse") return parseRadial(name, body, reference, id);
  if (name === "polygon") return parsePolygon(body, reference, id);
  if (name === "path") {
    const path = parsePath(body, id);
    // path() coordinates are already local user-space coordinates. The CSS
    // MVP intentionally does not reinterpret them through a reference box.
    return path;
  }
  fail("css-clip-path-unsupported", `Unsupported clip-path function: ${name}()`);
}
