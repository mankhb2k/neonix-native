import { fail } from "../errors";
import { edges, number } from "../css/values";
import type { Node, Style } from "../model";
import type { ResolvedGeometry } from "./geometry";
import type { LayoutBox } from "./layout-ir";

type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse";
type JustifyContent = "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
type AlignItems = "stretch" | "flex-start" | "flex-end" | "center" | "baseline";
type AlignContent = "stretch" | "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";

export type FlexPlacement = {
  node: Node;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FlexLayoutInput = {
  children: Node[];
  styles: Map<Node, Style>;
  containerStyle: Style;
  containerBox: LayoutBox;
  fontSize: number;
  viewport: { width: number; height: number };
  measure: (node: Node, containingWidth: number, containingHeight: number) => ResolvedGeometry;
};

type FlexItem = {
  node: Node;
  geometry: ResolvedGeometry;
  margin: [number, number, number, number];
  order: number;
  grow: number;
  shrink: number;
  baseMain: number;
  mainSize: number;
  crossSize: number;
  crossAuto: boolean;
  minMain: number;
  maxMain: number;
};

/** row/row-reverse share the horizontal main axis; column/column-reverse share the vertical one. Only the *-reverse variants flip which end is main-start (handled separately, the same way direction:rtl already is). */
function isRowAxis(direction: FlexDirection): boolean {
  return direction === "row" || direction === "row-reverse";
}

function flattenChildren(nodes: Node[], styles: Map<Node, Style>): Node[] {
  return nodes.flatMap((node) => keyword(styles.get(node) ?? new Map<string, string>(), "display", "block") === "contents" ? flattenChildren(node.children, styles) : [node]);
}

function keyword(style: Style, property: string, fallback: string): string {
  return (style.get(property) ?? fallback).trim().toLowerCase();
}

function nonNegativeNumber(style: Style, property: string, fallback: number): number {
  const raw = style.get(property);
  if (raw === undefined) return fallback;
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value < 0) fail("css-flex-number-invalid", `${property} must be a non-negative number: ${raw}`);
  return value;
}

function nonNegativeLength(style: Style, property: string, relative: number, fontSize: number, viewport: { width: number; height: number }): number {
  const raw = style.get(property);
  if (raw === undefined || raw.trim().toLowerCase() === "normal") return 0;
  const value = number(style, property, relative, fontSize, 16, viewport);
  if (!Number.isFinite(value) || value < 0) fail("css-flex-gap-invalid", `${property} must resolve to a non-negative length: ${raw}`);
  return value;
}

function flexBasis(style: Style, property: "width" | "height" | "flex-basis", relative: number, fontSize: number, viewport: { width: number; height: number }): number {
  const raw = style.get(property);
  if (raw === undefined || raw.trim().toLowerCase() === "auto") return Number.NaN;
  const value = number(style, property, relative, fontSize, 16, viewport);
  if (!Number.isFinite(value) || value < 0) fail("css-flex-basis-invalid", `${property} must resolve to a non-negative length: ${raw}`);
  return value;
}

function decorationSize(geometry: ResolvedGeometry, axis: FlexDirection): number {
  const padding = geometry.padding;
  const decorations = isRowAxis(axis)
    ? padding[1] + padding[3] + geometry.borderEdges[1] + geometry.borderEdges[3]
    : padding[0] + padding[2] + geometry.borderEdges[0] + geometry.borderEdges[2];
  return geometry.boxSizing === "content-box" ? decorations : 0;
}

function parseContainer(style: Style): { direction: FlexDirection; justify: JustifyContent; align: AlignItems; alignContent: AlignContent; wrap: FlexWrap } {
  const direction = keyword(style, "flex-direction", "row") as FlexDirection;
  if (!["row", "row-reverse", "column", "column-reverse"].includes(direction)) fail("css-flex-direction-unsupported", `Unsupported flex-direction value: ${direction}`);
  const justify = keyword(style, "justify-content", "flex-start") as JustifyContent;
  if (!["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"].includes(justify)) fail("css-flex-justify-unsupported", `Unsupported justify-content value: ${justify}`);
  const align = keyword(style, "align-items", "stretch") as AlignItems;
  if (!["stretch", "flex-start", "flex-end", "center", "baseline"].includes(align)) fail("css-flex-align-unsupported", `Unsupported align-items value: ${align}`);
  const wrap = keyword(style, "flex-wrap", "nowrap") as FlexWrap;
  if (!(["nowrap", "wrap", "wrap-reverse"] as string[]).includes(wrap)) fail("css-flex-wrap-unsupported", `Unsupported flex-wrap value: ${wrap}`);
  const alignContent = keyword(style, "align-content", "stretch") as AlignContent;
  if (!(["stretch", "flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"] as string[]).includes(alignContent)) fail("css-flex-align-content-unsupported", `Unsupported align-content value: ${alignContent}`);
  return { direction, justify, align, alignContent, wrap };
}

function parseAlignSelf(style: Style, fallback: AlignItems): AlignItems {
  const value = keyword(style, "align-self", "auto");
  if (value === "auto") return fallback;
  if (!["stretch", "flex-start", "flex-end", "center", "baseline"].includes(value)) fail("css-flex-align-self-unsupported", `Unsupported align-self value: ${value}`);
  return value as AlignItems;
}

function mainConstraint(style: Style, property: string, axis: FlexDirection, geometry: ResolvedGeometry, relative: number, fontSize: number, viewport: { width: number; height: number }, fallback: number): number {
  const raw = style.get(property);
  if (raw === undefined || raw.trim().toLowerCase() === "auto") return fallback;
  if (raw.trim().toLowerCase() === "none") return Number.POSITIVE_INFINITY;
  const resolved = number(style, property, relative, fontSize, 16, viewport);
  if (!Number.isFinite(resolved) || resolved < 0) fail("css-flex-constraint-invalid", `${property} must resolve to a non-negative length: ${raw}`);
  return resolved + (geometry.boxSizing === "content-box" ? decorationSize(geometry, axis) : 0);
}

function flexItemConfig(style: Style, axis: FlexDirection, geometry: ResolvedGeometry, mainRelative: number, fontSize: number, viewport: { width: number; height: number }): Pick<FlexItem, "grow" | "shrink" | "baseMain" | "minMain" | "maxMain"> {
  const grow = nonNegativeNumber(style, "flex-grow", 0);
  const shrink = nonNegativeNumber(style, "flex-shrink", 1);
  const basis = flexBasis(style, "flex-basis", mainRelative, fontSize, viewport);
  const measuredMain = isRowAxis(axis) ? geometry.width : geometry.height;
  const minProperty = isRowAxis(axis) ? "min-width" : "min-height";
  const maxProperty = isRowAxis(axis) ? "max-width" : "max-height";
  return { grow, shrink, baseMain: Number.isFinite(basis) ? basis + decorationSize(geometry, axis) : measuredMain, minMain: mainConstraint(style, minProperty, axis, geometry, mainRelative, fontSize, viewport, 0), maxMain: mainConstraint(style, maxProperty, axis, geometry, mainRelative, fontSize, viewport, Number.POSITIVE_INFINITY) };
}

export function resolveFlexLayout(input: FlexLayoutInput): FlexPlacement[] {
  const { direction, justify, align, alignContent, wrap } = parseContainer(input.containerStyle);
  const contentWidth = input.containerBox.contentWidth;
  const contentHeight = input.containerBox.contentHeight;
  const mainAvailable = isRowAxis(direction) ? contentWidth : contentHeight;
  const crossAvailable = isRowAxis(direction) ? contentHeight : contentWidth;
  const mainGapProperty = isRowAxis(direction) ? "column-gap" : "row-gap";
  const crossGapProperty = isRowAxis(direction) ? "row-gap" : "column-gap";
  const fallbackGap = input.containerStyle.has("gap") && !input.containerStyle.has("row-gap") && !input.containerStyle.has("column-gap")
    ? nonNegativeLength(input.containerStyle, "gap", contentWidth, input.fontSize, input.viewport)
    : 0;
  const mainGap = input.containerStyle.has(mainGapProperty) ? nonNegativeLength(input.containerStyle, mainGapProperty, contentWidth, input.fontSize, input.viewport) : fallbackGap;
  const crossGap = input.containerStyle.has(crossGapProperty) ? nonNegativeLength(input.containerStyle, crossGapProperty, contentWidth, input.fontSize, input.viewport) : fallbackGap;
  const items: FlexItem[] = [];

  const flexChildren = flattenChildren(input.children, input.styles);
  flexChildren.forEach((node) => {
    const style = input.styles.get(node) ?? new Map<string, string>();
    if (keyword(style, "display", "block") === "none" || keyword(style, "position", "static") === "absolute") return;
    if (keyword(style, "display", "block") === "contents") fail("css-flex-contents-unsupported", "display: contents inside a flex container is deferred until the flex formatting context supports flattened items");
    const geometry = input.measure(node, contentWidth, contentHeight);
    const margin = edges(style, "margin", contentWidth, input.fontSize, 16, input.viewport);
    if (!margin.every(Number.isFinite)) fail("css-flex-margin-invalid", "Flex item margins must resolve to finite lengths; auto margins are deferred");
    const config = flexItemConfig(style, direction, geometry, mainAvailable, input.fontSize, input.viewport);
    const orderRaw = style.get("order");
    const order = orderRaw === undefined ? 0 : Number(orderRaw);
    if (!Number.isSafeInteger(order)) fail("css-flex-order-invalid", `order must be an integer: ${orderRaw}`);
    const crossProperty = isRowAxis(direction) ? "height" : "width";
    items.push({
      node,
      geometry,
      margin,
      order,
      ...config,
      mainSize: config.baseMain,
      crossSize: isRowAxis(direction) ? geometry.height : geometry.width,
      crossAuto: style.get(crossProperty) === undefined || style.get(crossProperty)!.trim().toLowerCase() === "auto",
    });
  });

  items.sort((left, right) => left.order - right.order || flexChildren.indexOf(left.node) - flexChildren.indexOf(right.node));
  const mainMargins = (item: FlexItem): [number, number] => isRowAxis(direction) ? [item.margin[3], item.margin[1]] : [item.margin[0], item.margin[2]];
  const crossMargins = (item: FlexItem): [number, number] => isRowAxis(direction) ? [item.margin[0], item.margin[2]] : [item.margin[3], item.margin[1]];
  const itemMainOuter = (item: FlexItem) => { const [start, end] = mainMargins(item); return item.baseMain + start + end; };
  const lines: FlexItem[][] = [];
  let currentLine: FlexItem[] = [];
  let currentMain = 0;
  for (const item of items) {
    const nextMain = currentLine.length ? currentMain + mainGap + itemMainOuter(item) : itemMainOuter(item);
    if (wrap !== "nowrap" && currentLine.length > 0 && nextMain > mainAvailable) {
      lines.push(currentLine);
      currentLine = [];
      currentMain = 0;
    }
    currentLine.push(item);
    currentMain = currentLine.length === 1 ? itemMainOuter(item) : currentMain + mainGap + itemMainOuter(item);
  }
  if (currentLine.length) lines.push(currentLine);

  const lineMainData = lines.map((line) => {
    const fixedOuter = line.reduce((sum, item) => sum + item.baseMain + mainMargins(item)[0] + mainMargins(item)[1], 0);
    const freeSpace = mainAvailable - fixedOuter - Math.max(0, line.length - 1) * mainGap;
    if (freeSpace > 0) {
      const totalGrow = line.reduce((sum, item) => sum + item.grow, 0);
      if (totalGrow > 0) for (const item of line) item.mainSize = item.baseMain + freeSpace * item.grow / totalGrow;
    } else if (freeSpace < 0) {
      const totalShrink = line.reduce((sum, item) => sum + item.shrink * item.baseMain, 0);
      if (totalShrink > 0) for (const item of line) item.mainSize = Math.max(1, item.baseMain + freeSpace * item.shrink * item.baseMain / totalShrink);
    }
    for (const item of line) item.mainSize = Math.min(item.maxMain, Math.max(item.minMain, item.mainSize));
    const used = () => line.reduce((sum, item) => sum + item.mainSize + mainMargins(item)[0] + mainMargins(item)[1], 0) + Math.max(0, line.length - 1) * mainGap;
    let usedMain = used();
    if (usedMain > mainAvailable) {
      let overflow = usedMain - mainAvailable;
      const candidates = line.filter((item) => item.mainSize > item.minMain);
      const capacity = candidates.reduce((sum, item) => sum + Math.max(0, item.mainSize - item.minMain), 0);
      if (capacity > 0) for (const item of candidates) item.mainSize = Math.max(item.minMain, item.mainSize - overflow * Math.max(0, item.mainSize - item.minMain) / capacity);
      usedMain = used();
      overflow = Math.max(0, usedMain - mainAvailable);
      if (overflow > 0) for (const item of candidates) item.mainSize = Math.max(item.minMain, item.mainSize - overflow / candidates.length);
      usedMain = used();
    } else if (usedMain < mainAvailable) {
      const remaining = mainAvailable - usedMain;
      const candidates = line.filter((item) => item.grow > 0 && item.mainSize < item.maxMain);
      const totalGrow = candidates.reduce((sum, item) => sum + item.grow, 0);
      if (totalGrow > 0) for (const item of candidates) item.mainSize = Math.min(item.maxMain, item.mainSize + remaining * item.grow / totalGrow);
      usedMain = used();
    }
    return { line, remaining: Math.max(0, mainAvailable - usedMain) };
  });
  const mainLead = (remaining: number, count: number) => justify === "flex-end" ? remaining : justify === "center" ? remaining / 2 : justify === "space-around" ? remaining / (count || 1) / 2 : justify === "space-evenly" ? remaining / (count + 1) : 0;
  const mainDistributedGap = (remaining: number, count: number) => justify === "space-between" && count > 1 ? remaining / (count - 1) : justify === "space-around" ? remaining / (count || 1) : justify === "space-evenly" ? remaining / (count + 1) : 0;
  const lineCrossSizes = lineMainData.map(({ line }) => wrap === "nowrap" ? crossAvailable : Math.max(1, ...line.map((item) => item.crossSize + crossMargins(item)[0] + crossMargins(item)[1])));
  const crossUsed = lineCrossSizes.reduce((sum, size) => sum + size, 0) + Math.max(0, lineCrossSizes.length - 1) * crossGap;
  const crossRemaining = Math.max(0, crossAvailable - crossUsed);
  if (wrap !== "nowrap" && alignContent === "stretch" && lineCrossSizes.length > 0) {
    const stretch = crossRemaining / lineCrossSizes.length;
    for (let index = 0; index < lineCrossSizes.length; index += 1) lineCrossSizes[index]! += stretch;
  }
  const alignedCrossUsed = lineCrossSizes.reduce((sum, size) => sum + size, 0) + Math.max(0, lineCrossSizes.length - 1) * crossGap;
  const alignedCrossRemaining = Math.max(0, crossAvailable - alignedCrossUsed);
  const crossLead = alignContent === "flex-end" ? alignedCrossRemaining : alignContent === "center" ? alignedCrossRemaining / 2 : alignContent === "space-around" ? alignedCrossRemaining / (lineCrossSizes.length || 1) / 2 : alignContent === "space-evenly" ? alignedCrossRemaining / (lineCrossSizes.length + 1) : 0;
  const crossDistributedGap = alignContent === "space-between" && lineCrossSizes.length > 1 ? alignedCrossRemaining / (lineCrossSizes.length - 1) : alignContent === "space-around" ? alignedCrossRemaining / (lineCrossSizes.length || 1) : alignContent === "space-evenly" ? alignedCrossRemaining / (lineCrossSizes.length + 1) : 0;
  // row-reverse/column-reverse flip which end of the main axis is "start"
  // the same way direction:rtl already does for a plain row - mirror the
  // final position formula around the axis instead of reversing item order,
  // which gives the same visual result (including justify-content spacing,
  // since that's computed before this mirroring) with far less code.
  const reverseMain = direction === "row-reverse" || direction === "column-reverse" || (direction === "row" && keyword(input.containerStyle, "direction", "ltr") === "rtl");
  const placements: FlexPlacement[] = [];
  let crossCursor = crossLead;
  for (let lineIndex = 0; lineIndex < lineMainData.length; lineIndex += 1) {
    const { line, remaining } = lineMainData[lineIndex]!;
    const lineCrossSize = lineCrossSizes[lineIndex]!;
    const lineStart = wrap === "wrap-reverse" ? crossAvailable - crossCursor - lineCrossSize : crossCursor;
    const lead = mainLead(remaining, line.length);
    const distributedGap = mainDistributedGap(remaining, line.length);
    let mainCursor = lead;
    for (const item of line) {
      const [mainStartMargin, mainEndMargin] = mainMargins(item);
      const mainStart = reverseMain ? mainAvailable - mainCursor - mainStartMargin - item.mainSize : mainCursor + mainStartMargin;
      const itemAlign = parseAlignSelf(input.styles.get(item.node) ?? new Map<string, string>(), align);
      const [crossStartMargin, crossEndMargin] = crossMargins(item);
      if (itemAlign === "stretch" && item.crossAuto) item.crossSize = Math.max(1, lineCrossSize - crossStartMargin - crossEndMargin);
      const crossFree = Math.max(0, lineCrossSize - item.crossSize - crossStartMargin - crossEndMargin);
      const normalCrossOffset = itemAlign === "flex-end" ? crossFree + crossStartMargin : itemAlign === "center" ? crossFree / 2 + crossStartMargin : crossStartMargin;
      const reverseCrossOffset = itemAlign === "flex-end" ? crossStartMargin : itemAlign === "center" ? crossFree / 2 + crossStartMargin : lineCrossSize - crossEndMargin - item.crossSize;
      const crossStart = lineStart + (wrap === "wrap-reverse" ? reverseCrossOffset : normalCrossOffset);
      const relativeX = item.geometry.x - item.geometry.normalX;
      const relativeY = item.geometry.y - item.geometry.normalY;
      placements.push(isRowAxis(direction)
        ? { node: item.node, x: input.containerBox.contentX + mainStart + relativeX, y: input.containerBox.contentY + crossStart + relativeY, width: item.mainSize, height: item.crossSize }
        : { node: item.node, x: input.containerBox.contentX + crossStart + relativeX, y: input.containerBox.contentY + mainStart + relativeY, width: item.crossSize, height: item.mainSize });
      mainCursor += mainStartMargin + item.mainSize + mainEndMargin + mainGap + distributedGap;
    }
    crossCursor += lineCrossSize + crossGap + crossDistributedGap;
  }
  return placements;
}
