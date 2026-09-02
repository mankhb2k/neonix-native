import type { PathContour, PathMesh, PathPoint } from "../../paint/paint-types";
import { flattenPathContourAny } from "./flatten";
import { tessellateFillContours } from "./fill-triangulation";
import { tessellateStrokeOutline } from "./stroke-outline";

type Token = string;

function tokenize(value: string): Token[] {
  return [...value.matchAll(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)].map((match) => match[0]!);
}

function isCommand(token: string | undefined): boolean {
  return token !== undefined && /^[A-Za-z]$/.test(token);
}

/** Parse an outline path emitted by harfbuzzjs into SVG path contours. */
function parseGlyphContours(value: string): PathContour[] | null {
  const tokens = tokenize(value);
  if (tokens.length === 0) return null;
  const contours: PathContour[] = [];
  let cursor: PathPoint = { x: 0, y: 0 };
  let command: string | undefined;
  let previousCubic: PathPoint | null = null;
  let previousQuadratic: PathPoint | null = null;
  let contour: PathContour | null = null;
  let contourIndex = 0;
  let index = 0;

  const readNumber = (): number | null => {
    const token = tokens[index++];
    if (token === undefined || isCommand(token)) return null;
    const number = Number(token);
    return Number.isFinite(number) ? number : null;
  };
  const readPoint = (relative: boolean): PathPoint | null => {
    const x = readNumber();
    const y = readNumber();
    if (x === null || y === null) return null;
    return relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y };
  };
  const finishContour = () => {
    if (contour && contour.segments.length > 0) contours.push(contour);
    contour = null;
  };
  const requireContour = (): PathContour | null => contour;

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) return null;
    const kind = command.toUpperCase();
    const relative = command === command.toLowerCase();
    if (kind === "Z") {
      if (!contour) return null;
      contour.closed = true;
      cursor = contour.start;
      previousCubic = null;
      previousQuadratic = null;
      command = undefined;
      continue;
    }

    if (kind === "M") {
      const point = readPoint(relative);
      if (!point) return null;
      finishContour();
      contour = { id: `glyph-contour-${contourIndex++}`, start: point, segments: [], closed: false };
      cursor = point;
      previousCubic = null;
      previousQuadratic = null;
      command = relative ? "l" : "L";
      continue;
    }

    const active = requireContour();
    if (!active) return null;
    if (kind === "L") {
      const point = readPoint(relative);
      if (!point) return null;
      active.segments.push({ kind: "line", to: point });
      cursor = point;
      previousCubic = null;
      previousQuadratic = null;
    } else if (kind === "H" || kind === "V") {
      const valuePart = readNumber();
      if (valuePart === null) return null;
      const point = kind === "H"
        ? { x: relative ? cursor.x + valuePart : valuePart, y: cursor.y }
        : { x: cursor.x, y: relative ? cursor.y + valuePart : valuePart };
      active.segments.push({ kind: "line", to: point });
      cursor = point;
      previousCubic = null;
      previousQuadratic = null;
    } else if (kind === "C" || kind === "S") {
      const control1 = kind === "S"
        ? previousCubic
          ? { x: cursor.x * 2 - previousCubic.x, y: cursor.y * 2 - previousCubic.y }
          : cursor
        : readPoint(relative);
      const control2 = readPoint(relative);
      const point = readPoint(relative);
      if (!control1 || !control2 || !point) return null;
      active.segments.push({ kind: "cubic", control1, control2, to: point });
      cursor = point;
      previousCubic = control2;
      previousQuadratic = null;
    } else if (kind === "Q" || kind === "T") {
      const control: PathPoint | null = kind === "T"
        ? previousQuadratic
          ? { x: cursor.x * 2 - previousQuadratic.x, y: cursor.y * 2 - previousQuadratic.y }
          : cursor
        : readPoint(relative);
      const point = readPoint(relative);
      if (!control || !point) return null;
      active.segments.push({ kind: "quadratic", control, to: point });
      cursor = point;
      previousQuadratic = control;
      previousCubic = null;
    } else if (kind === "A") {
      const rx = readNumber();
      const ry = readNumber();
      const rotation = readNumber();
      const largeArc = readNumber();
      const sweep = readNumber();
      const point = readPoint(relative);
      if (rx === null || ry === null || rotation === null || largeArc === null || sweep === null || !point) return null;
      active.segments.push({
        kind: "arc",
        radii: { x: Math.abs(rx), y: Math.abs(ry) },
        rotation,
        largeArc: largeArc !== 0,
        sweep: sweep !== 0,
        to: point,
      });
      cursor = point;
      previousCubic = null;
      previousQuadratic = null;
    } else {
      return null;
    }
  }
  finishContour();
  return contours.length > 0 ? contours : null;
}

/**
 * Convert one font outline into a positioned local mesh. The mesh uses the
 * same unhinted outline that export emits as SVG path data, so preview and
 * export share geometry rather than sharing a low-resolution bitmap.
 */
export function glyphPathToMesh(
  path: string,
  pathScale: number,
  outline: { x: number; y: number },
  x: number,
  y: number,
): PathMesh | null {
  const contours = parseGlyphContours(path);
  if (!contours || !Number.isFinite(pathScale) || pathScale <= 0) return null;
  try {
    const mesh = tessellateFillContours(contours.map(flattenPathContourAny), "nonzero");
    const vertices: number[] = [];
    for (let index = 0; index < mesh.vertices.length; index += 2) {
      const fontX = mesh.vertices[index]!;
      const fontY = mesh.vertices[index + 1]!;
      vertices.push(
        x + (fontX - outline.x) * pathScale,
        y + (outline.y - fontY) * pathScale,
      );
    }
    const points = Array.from({ length: vertices.length / 2 }, (_, pointIndex) => ({
      x: vertices[pointIndex * 2]!,
      y: vertices[pointIndex * 2 + 1]!,
    }));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      vertices,
      indices: mesh.indices,
      bounds: {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      },
    };
  } catch {
    return null;
  }
}

export function glyphPathToStrokeMesh(
  path: string,
  pathScale: number,
  outline: { x: number; y: number },
  x: number,
  y: number,
  strokeWidth: number,
): PathMesh | null {
  const contours = parseGlyphContours(path);
  if (!contours || !Number.isFinite(pathScale) || pathScale <= 0 || !Number.isFinite(strokeWidth) || strokeWidth <= 0) return null;
  try {
    const mesh = tessellateStrokeOutline(
      contours.map(flattenPathContourAny),
      strokeWidth / pathScale,
      { join: "round", cap: "round" },
    );
    const vertices: number[] = [];
    for (let index = 0; index < mesh.vertices.length; index += 2) {
      const fontX = mesh.vertices[index]!;
      const fontY = mesh.vertices[index + 1]!;
      vertices.push(
        x + (fontX - outline.x) * pathScale,
        y + (outline.y - fontY) * pathScale,
      );
    }
    const points = Array.from({ length: vertices.length / 2 }, (_, pointIndex) => ({
      x: vertices[pointIndex * 2]!,
      y: vertices[pointIndex * 2 + 1]!,
    }));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      vertices,
      indices: mesh.indices,
      bounds: {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      },
    };
  } catch {
    return null;
  }
}

export function transformPathMesh(
  mesh: PathMesh,
  transform: { translateX?: number; translateY?: number; scaleX?: number; rotation?: number; originX?: number; originY?: number },
): PathMesh {
  const translateX = transform.translateX ?? 0;
  const translateY = transform.translateY ?? 0;
  const scaleX = transform.scaleX ?? 1;
  const angle = ((transform.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const originX = transform.originX ?? 0;
  const originY = transform.originY ?? 0;
  const vertices: number[] = [];
  for (let index = 0; index < mesh.vertices.length; index += 2) {
    const sourceX = mesh.vertices[index]!;
    const sourceY = mesh.vertices[index + 1]!;
    const scaledX = originX + (sourceX - originX) * scaleX;
    const dx = scaledX - originX;
    const dy = sourceY - originY;
    vertices.push(
      originX + dx * cos - dy * sin + translateX,
      originY + dx * sin + dy * cos + translateY,
    );
  }
  const points = Array.from({ length: vertices.length / 2 }, (_, pointIndex) => ({ x: vertices[pointIndex * 2]!, y: vertices[pointIndex * 2 + 1]! }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    vertices,
    indices: [...mesh.indices],
    bounds: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) },
  };
}
