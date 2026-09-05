import { fail } from "./errors";
import { calcExpression, edges } from "./values";
import type { Node, Style } from "./model";
import type { ResolvedGeometry } from "./geometry";
import type { LayoutBox } from "./layout-ir";

type TrackKind = "length" | "fr" | "auto";
type Track = { kind: TrackKind; value: number };
type GridAlignment = "stretch" | "start" | "end" | "center";
type ContentAlignment = "stretch" | "start" | "end" | "center" | "space-between" | "space-around" | "space-evenly";

export type GridPlacement = {
  node: Node;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GridLayoutInput = {
  children: Node[];
  styles: Map<Node, Style>;
  containerStyle: Style;
  containerBox: LayoutBox;
  fontSize: number;
  viewport: { width: number; height: number };
  measure: (node: Node, containingWidth: number, containingHeight: number) => ResolvedGeometry;
};

type GridItem = {
  node: Node;
  geometry: ResolvedGeometry;
  margin: [number, number, number, number];
  colStart?: number;
  colEnd?: number;
  rowStart?: number;
  rowEnd?: number;
  colSpan: number;
  rowSpan: number;
  col?: number;
  row?: number;
  preferredWidth: number;
  preferredHeight: number;
  order: number;
};

function value(style: Style, property: string, fallback: string): string {
  return (style.get(property) ?? fallback).trim().toLowerCase();
}

function flattenChildren(nodes: Node[], styles: Map<Node, Style>): Node[] {
  return nodes.flatMap((node) => value(styles.get(node) ?? new Map<string, string>(), "display", "block") === "contents" ? flattenChildren(node.children, styles) : [node]);
}

function expandRepeat(input: string): string[] {
  const result: string[] = [];
  const tokens: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === "(") depth += 1;
    else if (input[index] === ")") depth -= 1;
    if (depth === 0 && /\s/.test(input[index] ?? "")) {
      if (input.slice(start, index).trim()) tokens.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (input.slice(start).trim()) tokens.push(input.slice(start).trim());
  for (const token of tokens) {
    const match = token.match(/^repeat\((\d+),(.+)\)$/i);
    if (!match) result.push(token);
    else {
      const count = Number(match[1]);
      const inner = match[2]!.trim();
      if (!Number.isSafeInteger(count) || count < 1 || /[(),]/.test(inner)) fail("css-grid-repeat-unsupported", `repeat() only supports one simple track: ${token}`);
      for (let index = 0; index < count; index += 1) result.push(inner);
    }
  }
  return result;
}

function parseTracks(raw: string | undefined, relative: number, fontSize: number, viewport: { width: number; height: number }, fallback: string): Track[] {
  const tokens = expandRepeat(raw ?? fallback);
  if (tokens.length === 0) fail("css-grid-template-invalid", "Grid template must contain at least one track");
  return tokens.map((token) => {
    if (token === "auto") return { kind: "auto", value: 0 } as Track;
    const fr = token.match(/^([0-9]*\.?[0-9]+)fr$/i);
    if (fr) {
      const units = Number(fr[1]);
      if (!Number.isFinite(units) || units <= 0) fail("css-grid-track-invalid", `Grid fr track must be positive: ${token}`);
      return { kind: "fr", value: units } as Track;
    }
    const resolved = calcExpression(token, "grid-template-track", relative, fontSize, 16, viewport).value;
    if (!Number.isFinite(resolved) || resolved < 0) fail("css-grid-track-invalid", `Grid track must resolve to a non-negative length: ${token}`);
    return { kind: "length", value: resolved } as Track;
  });
}

function gap(style: Style, property: string, fallback: number, relative: number, fontSize: number, viewport: { width: number; height: number }): number {
  const raw = style.get(property);
  if (raw === undefined) return fallback;
  const resolved = calcExpression(raw, property, relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(resolved) || resolved < 0) fail("css-grid-gap-invalid", `${property} must resolve to a non-negative length: ${raw}`);
  return resolved;
}

function parseAlignment(style: Style, property: string, fallback: GridAlignment): GridAlignment {
  const result = value(style, property, fallback);
  if (!["stretch", "start", "end", "center"].includes(result)) fail("css-grid-item-alignment-unsupported", `Unsupported ${property} value: ${result}`);
  return result as GridAlignment;
}

function parseContentAlignment(style: Style, property: string): ContentAlignment {
  const result = value(style, property, "stretch");
  if (!["stretch", "start", "end", "center", "space-between", "space-around", "space-evenly", "flex-start", "flex-end"].includes(result)) fail("css-grid-content-alignment-unsupported", `Unsupported ${property} value: ${result}`);
  return result === "flex-start" ? "start" : result === "flex-end" ? "end" : result as ContentAlignment;
}

function lineNumber(raw: string | undefined, property: string): number | undefined {
  if (raw === undefined || raw.trim().toLowerCase() === "auto") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized.startsWith("span ")) return undefined;
  const result = Number(normalized);
  if (!Number.isSafeInteger(result) || result < 1) fail("css-grid-line-invalid", `${property} must be a positive grid line or auto: ${raw}`);
  return result;
}

function spanNumber(raw: string | undefined, property: string): number | undefined {
  if (raw === undefined) return undefined;
  const match = raw.trim().toLowerCase().match(/^span\s+(\d+)$/);
  if (!match) return undefined;
  const result = Number(match[1]);
  if (!Number.isSafeInteger(result) || result < 1) fail("css-grid-span-invalid", `${property} span must be a positive integer: ${raw}`);
  return result;
}

function resolveTrackSizes(tracks: Track[], available: number, gapSize: number): number[] {
  const fixed = tracks.reduce((sum, track) => sum + (track.kind === "length" ? track.value : 0), 0);
  const auto = tracks.filter((track) => track.kind === "auto");
  const remaining = Math.max(0, available - fixed - Math.max(0, tracks.length - 1) * gapSize);
  const autoSize = auto.length ? 0 : 0;
  const frUnits = tracks.reduce((sum, track) => sum + (track.kind === "fr" ? track.value : 0), 0);
  const frSize = frUnits > 0 ? Math.max(0, remaining - autoSize) / frUnits : 0;
  return tracks.map((track) => track.kind === "length" ? track.value : track.kind === "fr" ? frSize * track.value : 0);
}

function contentOffset(mode: ContentAlignment, remaining: number, count: number): { lead: number; gap: number } {
  if (mode === "end") return { lead: remaining, gap: 0 };
  if (mode === "center") return { lead: remaining / 2, gap: 0 };
  if (mode === "space-between" && count > 1) return { lead: 0, gap: remaining / (count - 1) };
  if (mode === "space-around") return { lead: remaining / (count || 1) / 2, gap: remaining / (count || 1) };
  if (mode === "space-evenly") return { lead: remaining / (count + 1), gap: remaining / (count + 1) };
  // Fixed tracks keep their authored size; an auto track may be stretched by
  // a later sizing pass. Do not turn leftover space into implicit gaps.
  return { lead: 0, gap: 0 };
}

function fits(occupied: boolean[][], row: number, col: number, rowSpan: number, colSpan: number, rows: number, columns: number): boolean {
  if (row < 0 || col < 0 || col + colSpan > columns || row + rowSpan > rows) return false;
  for (let y = row; y < row + rowSpan; y += 1) for (let x = col; x < col + colSpan; x += 1) if (occupied[y]?.[x]) return false;
  return true;
}

function occupy(occupied: boolean[][], row: number, col: number, rowSpan: number, colSpan: number): void {
  for (let y = row; y < row + rowSpan; y += 1) for (let x = col; x < col + colSpan; x += 1) occupied[y]![x] = true;
}

export function resolveGridLayout(input: GridLayoutInput): GridPlacement[] {
  const contentWidth = input.containerBox.contentWidth;
  const contentHeight = input.containerBox.contentHeight;
  const baseGap = gap(input.containerStyle, "gap", 0, contentWidth, input.fontSize, input.viewport);
  const columnGap = gap(input.containerStyle, "column-gap", baseGap, contentWidth, input.fontSize, input.viewport);
  const rowGap = gap(input.containerStyle, "row-gap", baseGap, contentWidth, input.fontSize, input.viewport);
  const columns = parseTracks(input.containerStyle.get("grid-template-columns"), contentWidth, input.fontSize, input.viewport, "1fr");
  const rows = parseTracks(input.containerStyle.get("grid-template-rows"), contentHeight, input.fontSize, input.viewport, "auto");
  let columnSizes = resolveTrackSizes(columns, contentWidth, columnGap);
  let rowSizes = resolveTrackSizes(rows, contentHeight, rowGap);
  const columnCount = columnSizes.length;
  let rowCount = rowSizes.length;
  const items: GridItem[] = [];

  const gridChildren = flattenChildren(input.children, input.styles);
  for (const node of gridChildren) {
    const style = input.styles.get(node) ?? new Map<string, string>();
    if (value(style, "display", "block") === "none" || value(style, "position", "static") === "absolute") continue;
    if (value(style, "display", "block") === "contents") fail("css-grid-contents-unsupported", "display: contents inside a grid container is deferred until grid flattening is supported");
    const colStart = lineNumber(style.get("grid-column-start"), "grid-column-start");
    const rowStart = lineNumber(style.get("grid-row-start"), "grid-row-start");
    const colStartSpan = spanNumber(style.get("grid-column-start"), "grid-column-start");
    const rowStartSpan = spanNumber(style.get("grid-row-start"), "grid-row-start");
    const colEnd = lineNumber(style.get("grid-column-end"), "grid-column-end");
    const rowEnd = lineNumber(style.get("grid-row-end"), "grid-row-end");
    const colEndSpan = spanNumber(style.get("grid-column-end"), "grid-column-end");
    const rowEndSpan = spanNumber(style.get("grid-row-end"), "grid-row-end");
    const colSpan = colEndSpan ?? colStartSpan ?? (colStart !== undefined && colEnd !== undefined ? colEnd - colStart : 1);
    const rowSpan = rowEndSpan ?? rowStartSpan ?? (rowStart !== undefined && rowEnd !== undefined ? rowEnd - rowStart : 1);
    if (colSpan < 1 || rowSpan < 1) fail("css-grid-span-invalid", "Grid spans must be positive");
    if ((colStart !== undefined && colStart + colSpan - 1 > columnCount) || (colEnd !== undefined && colEnd > columnCount + 1)) fail("css-grid-column-out-of-range", "Grid column placement exceeds the explicit column template");
    const geometry = input.measure(node, contentWidth, contentHeight);
    const orderRaw = style.get("order");
    const order = orderRaw === undefined ? 0 : Number(orderRaw);
    if (!Number.isSafeInteger(order)) fail("css-grid-order-invalid", `order must be an integer: ${orderRaw}`);
    items.push({ node, geometry, margin: edges(style, "margin", contentWidth, input.fontSize, 16, input.viewport), colStart, colEnd, rowStart, rowEnd, colSpan, rowSpan, preferredWidth: style.get("width") && style.get("width")!.trim().toLowerCase() !== "auto" ? geometry.width : 0, preferredHeight: style.get("height") && style.get("height")!.trim().toLowerCase() !== "auto" ? geometry.height : 0, order });
    if (rowStart !== undefined) rowCount = Math.max(rowCount, rowStart + rowSpan - 1);
  }

  items.sort((left, right) => left.order - right.order || gridChildren.indexOf(left.node) - gridChildren.indexOf(right.node));

  const occupied = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => false));
  let cursorRow = 0;
  let cursorCol = 0;
  for (const item of items) {
    const explicitRow = item.rowStart !== undefined;
    const explicitCol = item.colStart !== undefined;
    const startRow = explicitRow ? item.rowStart! - 1 : 0;
    const startCol = explicitCol ? item.colStart! - 1 : 0;
    if (startRow + item.rowSpan > occupied.length) {
      for (let row = occupied.length; row < startRow + item.rowSpan; row += 1) occupied.push(Array.from({ length: columnCount }, () => false));
    }
    let foundRow = startRow;
    let foundCol = startCol;
    if (explicitRow && explicitCol) {
      if (!fits(occupied, foundRow, foundCol, item.rowSpan, item.colSpan, occupied.length, columnCount)) fail("css-grid-overlap-invalid", `Grid item ${item.node.atomicId} overlaps an occupied cell or exceeds the grid`);
    } else {
      let found = false;
      for (let row = explicitRow ? startRow : cursorRow; row < occupied.length && !found; row += 1) {
        const firstCol = explicitCol ? startCol : row === cursorRow ? cursorCol : 0;
        for (let col = firstCol; col < columnCount; col += 1) if (fits(occupied, row, col, item.rowSpan, item.colSpan, occupied.length, columnCount)) { foundRow = row; foundCol = col; found = true; break; }
      }
      if (!found) {
        if (explicitRow) fail("css-grid-placement-invalid", `Grid item ${item.node.atomicId} does not fit its explicit row`);
        foundRow = occupied.length;
        for (let row = occupied.length; row < foundRow + item.rowSpan; row += 1) occupied.push(Array.from({ length: columnCount }, () => false));
        foundCol = 0;
      }
    }
    item.row = foundRow;
    item.col = foundCol;
    occupy(occupied, foundRow, foundCol, item.rowSpan, item.colSpan);
    cursorRow = foundRow;
    cursorCol = foundCol + item.colSpan;
    if (cursorCol >= columnCount) { cursorRow += 1; cursorCol = 0; }
  }
  rowCount = Math.max(rowCount, occupied.length);
  while (rowSizes.length < rowCount) rowSizes.push(0);
  const resolvedColumns = columns.map((track, index) => track.kind === "auto" ? Math.max(0, ...items.filter((item) => item.col === index && item.colSpan === 1).map((item) => item.preferredWidth)) : columnSizes[index] ?? 0);
  const rowTracks = [...rows, ...Array.from({ length: Math.max(0, rowSizes.length - rows.length) }, () => ({ kind: "auto" as const, value: 0 }))];
  const resolvedRows = rowTracks.map((track, index) => track.kind === "auto" ? Math.max(0, ...items.filter((item) => item.row === index && item.rowSpan === 1).map((item) => item.preferredHeight)) : rowSizes[index] ?? 0);
  columnSizes = resolveTrackSizes(columns.map((track, index) => track.kind === "auto" ? { kind: "length" as const, value: resolvedColumns[index] ?? 0 } : track), contentWidth, columnGap);
  rowSizes = resolveTrackSizes(rowTracks.map((track, index) => track.kind === "auto" ? { kind: "length" as const, value: resolvedRows[index] ?? 0 } : track), contentHeight, rowGap);

  const totalWidth = columnSizes.reduce((sum, size) => sum + size, 0) + Math.max(0, columnSizes.length - 1) * columnGap;
  const totalHeight = rowSizes.reduce((sum, size) => sum + size, 0) + Math.max(0, rowSizes.length - 1) * rowGap;
  const xAlign = contentOffset(parseContentAlignment(input.containerStyle, "justify-content"), Math.max(0, contentWidth - totalWidth), columnSizes.length);
  const yAlign = contentOffset(parseContentAlignment(input.containerStyle, "align-content"), Math.max(0, contentHeight - totalHeight), rowSizes.length);
  const justifyItems = parseAlignment(input.containerStyle, "justify-items", "stretch");
  const alignItems = parseAlignment(input.containerStyle, "align-items", "stretch");
  const placements: GridPlacement[] = [];
  for (const item of items) {
    const col = item.col!;
    const row = item.row!;
    const cellX = input.containerBox.contentX + xAlign.lead + columnSizes.slice(0, col).reduce((sum, size) => sum + size, 0) + Math.max(0, col) * (columnGap + xAlign.gap);
    const cellY = input.containerBox.contentY + yAlign.lead + rowSizes.slice(0, row).reduce((sum, size) => sum + size, 0) + Math.max(0, row) * (rowGap + yAlign.gap);
    const cellWidth = columnSizes.slice(col, col + item.colSpan).reduce((sum, size) => sum + size, 0) + Math.max(0, item.colSpan - 1) * columnGap;
    const cellHeight = rowSizes.slice(row, row + item.rowSpan).reduce((sum, size) => sum + size, 0) + Math.max(0, item.rowSpan - 1) * rowGap;
    const style = input.styles.get(item.node) ?? new Map<string, string>();
    const justify = parseAlignment(style, "justify-self", justifyItems);
    const align = parseAlignment(style, "align-self", alignItems);
    const [top, right, bottom, left] = item.margin;
    const autoWidth = style.get("width") === undefined || style.get("width")!.trim().toLowerCase() === "auto";
    const autoHeight = style.get("height") === undefined || style.get("height")!.trim().toLowerCase() === "auto";
    const width = justify === "stretch" && autoWidth ? Math.max(1, cellWidth - left - right) : item.geometry.width;
    const height = align === "stretch" && autoHeight ? Math.max(1, cellHeight - top - bottom) : item.geometry.height;
    const x = justify === "end" ? cellX + cellWidth - right - width : justify === "center" ? cellX + (cellWidth - width - left - right) / 2 + left : cellX + left;
    const y = align === "end" ? cellY + cellHeight - bottom - height : align === "center" ? cellY + (cellHeight - height - top - bottom) / 2 + top : cellY + top;
    placements.push({ node: item.node, x: x + item.geometry.x - item.geometry.normalX, y: y + item.geometry.y - item.geometry.normalY, width, height });
  }
  return placements;
}
