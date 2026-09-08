import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { fail } from "./errors";
import { parseColor } from "./paint";
import type { Node, Style } from "./model";

type CompiledPathContour = Extract<MotionProtocolV2["layers"][number], { type: "path" }>["payload"]["contours"][number];
type CompiledPathSegment = CompiledPathContour["segments"][number];
type PathPoint = CompiledPathContour["start"];

export function parseSvgPathData(value: string, property = "path d"): CompiledPathContour[] {
  const tokens = [...value.matchAll(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)].map((match) => match[0]!);
  if (tokens.length === 0) fail("svg-path-empty", `${property} must contain path data`);
  const isCommand = (token: string | undefined): boolean => token !== undefined && /^[A-Za-z]$/.test(token);
  const contours: CompiledPathContour[] = [];
  let cursor: PathPoint = { x: 0, y: 0 };
  let command: string | undefined;
  let contour: { id: string; start: PathPoint; segments: CompiledPathSegment[]; closed: boolean } | undefined;
  let contourIndex = 0;
  let index = 0;
  const readNumber = (): number => {
    const token = tokens[index++];
    if (token === undefined || isCommand(token)) fail("svg-path-invalid", `${property} contains an incomplete command`);
    const number = Number(token); if (!Number.isFinite(number)) fail("svg-path-invalid", `${property} contains a non-finite coordinate`); return number;
  };
  const point = (x: number, y: number, relative: boolean): PathPoint => relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y };
  const finishContour = () => {
    if (!contour) return;
    if (contour.segments.length === 0) fail("svg-path-invalid", `${property} contour ${contour.id} has no segments`);
    contours.push(contour as CompiledPathContour); contour = undefined;
  };
  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) fail("svg-path-invalid", `${property} must begin with a command`);
    const activeCommand = command!;
    const relative = activeCommand === activeCommand.toLowerCase();
    const kind = activeCommand.toUpperCase();
    if (kind === "Z") {
      if (!contour) fail("svg-path-invalid", `${property} close command has no contour`);
      const activeContour = contour!;
      if (cursor.x !== activeContour.start.x || cursor.y !== activeContour.start.y) activeContour.segments.push({ kind: "line", to: activeContour.start });
      activeContour.closed = true; cursor = activeContour.start; command = undefined; continue;
    }
    if (!["M", "L", "H", "V", "C"].includes(kind)) fail("svg-path-command-unsupported", `${property} command ${command} is not supported; use M, L, H, V, C or Z`);
    if (kind === "M") {
      if (isCommand(tokens[index])) fail("svg-path-invalid", `${property} move command requires coordinates`);
      const next = point(readNumber(), readNumber(), relative);
      finishContour(); contour = { id: `contour-${contourIndex++}`, start: next, segments: [], closed: false }; cursor = next; command = relative ? "l" : "L"; continue;
    }
    if (!contour) fail("svg-path-invalid", `${property} drawing command has no initial move`);
    const activeContour = contour!;
    if (kind === "L") {
      if (isCommand(tokens[index])) fail("svg-path-invalid", `${property} line command requires coordinates`);
      const next = point(readNumber(), readNumber(), relative); activeContour.segments.push({ kind: "line", to: next }); cursor = next; continue;
    }
    if (kind === "H") {
      const x = readNumber(); const next = relative ? { x: cursor.x + x, y: cursor.y } : { x, y: cursor.y }; activeContour.segments.push({ kind: "line", to: next }); cursor = next; continue;
    }
    if (kind === "V") {
      const y = readNumber(); const next = relative ? { x: cursor.x, y: cursor.y + y } : { x: cursor.x, y }; activeContour.segments.push({ kind: "line", to: next }); cursor = next; continue;
    }
    if (isCommand(tokens[index])) fail("svg-path-invalid", `${property} cubic command requires six coordinates`);
    const control1 = point(readNumber(), readNumber(), relative); const control2 = point(readNumber(), readNumber(), relative); const next = point(readNumber(), readNumber(), relative);
    activeContour.segments.push({ kind: "cubic", control1, control2, to: next }); cursor = next;
  }
  finishContour();
  return contours;
}

function parsePathNumber(value: string | undefined, property: string, positive = false): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value.trim().replace(/px$/i, ""));
  if (!Number.isFinite(number) || (positive && number <= 0)) fail("css-path-value-invalid", `${property} must be ${positive ? "a positive " : "a finite "}number: ${value}`);
  return number;
}

function parsePathDash(value: string | undefined): { array: number[]; offset?: number } | undefined {
  if (value === undefined || value.trim().toLowerCase() === "none") return undefined;
  const parts = value.split(/\s*,\s*|\s+/).filter(Boolean);
  return { array: parts.map((part) => parsePathNumber(part, "stroke-dasharray", true)!) };
}

function parsePaintOrder(value: string | undefined): Array<"fill" | "stroke" | "markers"> | undefined {
  if (value === undefined || value.trim().toLowerCase() === "normal") return undefined;
  const parts = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !["fill", "stroke", "markers"].includes(part)) || new Set(parts).size !== parts.length) {
    fail("css-path-paint-order-invalid", `paint-order must contain unique fill, stroke and markers tokens: ${value}`);
  }
  return parts as Array<"fill" | "stroke" | "markers">;
}

export function parsePathStyle(node: Node, style: Style, currentColor = "#000000"): { fill?: string; fillOpacity?: number; stroke?: string; strokeWidth?: number; strokeOpacity?: number; strokeJoin?: "miter" | "bevel" | "round"; strokeCap?: "butt" | "square" | "round"; strokeDash?: { array: number[]; offset?: number }; paintOrder?: Array<"fill" | "stroke" | "markers"> } {
  const fillValue = style.get("fill") ?? node.attributes.get("fill"); const strokeValue = style.get("stroke") ?? node.attributes.get("stroke");
  // Keep an authored `fill: none` distinguishable from an omitted fill. SVG
  // defaults an omitted path fill to black, while an explicit none must stay
  // a paint absence all the way through Protocol V2 and Runtime V2.
  const fill = fillValue === undefined ? undefined : fillValue.toLowerCase() === "none" ? "none" : parseColor(fillValue, "fill", currentColor);
  const stroke = strokeValue === undefined || strokeValue.toLowerCase() === "none" ? undefined : parseColor(strokeValue, "stroke", currentColor);
  const fillOpacity = parsePathNumber(style.get("fill-opacity") ?? node.attributes.get("fill-opacity"), "fill-opacity");
  const strokeWidth = parsePathNumber(style.get("stroke-width") ?? node.attributes.get("stroke-width"), "stroke-width", true);
  const strokeOpacity = parsePathNumber(style.get("stroke-opacity") ?? node.attributes.get("stroke-opacity"), "stroke-opacity");
  if (fillOpacity !== undefined && (fillOpacity < 0 || fillOpacity > 1)) fail("css-path-opacity-invalid", "fill-opacity must be between 0 and 1");
  if (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1)) fail("css-path-opacity-invalid", "stroke-opacity must be between 0 and 1");
  const strokeJoinValue = (style.get("stroke-linejoin") ?? node.attributes.get("stroke-linejoin"))?.toLowerCase();
  const strokeCapValue = (style.get("stroke-linecap") ?? node.attributes.get("stroke-linecap"))?.toLowerCase();
  if (strokeJoinValue !== undefined && !["miter", "bevel", "round"].includes(strokeJoinValue)) fail("css-path-stroke-join-invalid", `Unsupported stroke-linejoin: ${strokeJoinValue}`);
  if (strokeCapValue !== undefined && !["butt", "square", "round"].includes(strokeCapValue)) fail("css-path-stroke-cap-invalid", `Unsupported stroke-linecap: ${strokeCapValue}`);
  const dashValue = style.get("stroke-dasharray") ?? node.attributes.get("stroke-dasharray"); const dash = parsePathDash(dashValue);
  const dashOffset = parsePathNumber(style.get("stroke-dashoffset") ?? node.attributes.get("stroke-dashoffset"), "stroke-dashoffset");
  const strokeDash = dash ? { ...dash, ...(dashOffset === undefined ? {} : { offset: dashOffset }) } : undefined;
  const paintOrder = parsePaintOrder(style.get("paint-order") ?? node.attributes.get("paint-order"));
  return { ...(fill === undefined ? {} : { fill }), ...(fillOpacity === undefined ? {} : { fillOpacity }), ...(stroke === undefined ? {} : { stroke }), ...(strokeWidth === undefined ? {} : { strokeWidth }), ...(strokeOpacity === undefined ? {} : { strokeOpacity }), ...(strokeJoinValue === undefined ? {} : { strokeJoin: strokeJoinValue as "miter" | "bevel" | "round" }), ...(strokeCapValue === undefined ? {} : { strokeCap: strokeCapValue as "butt" | "square" | "round" }), ...(strokeDash === undefined ? {} : { strokeDash }), ...(paintOrder === undefined ? {} : { paintOrder }) };
}
