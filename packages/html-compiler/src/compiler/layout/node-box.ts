import type { LayoutOverride } from "../compile-context";
import type { HtmlTextSizingLookup } from "../../source";
import type { CssViewport } from "../css/values";
import { edges, number } from "../css/values";
import { computed } from "../css/cascade";
import { parseLineClamp, parseLineHeight, parseWhiteSpace } from "../css/typography";
import { parseBorderEdges } from "../paint/paint";
import { resolveTextContentWidth, textSizingCacheKey } from "../text-sizing";
import { collectTextContentWithBreaks, isTextFlowNode, normalizeTextContent } from "../lowering/dispatcher";
import type { Node, Rule, Style } from "../model";
import { resolveAnchorStyle } from "./anchor";
import { resolveGeometry, resizeResolvedGeometry, type ResolvedGeometry } from "./geometry";
import { assertLayoutBox, type LayoutBox, type LayoutRect } from "./layout-ir";
import { collapseVerticalMargins } from "./layout";

/**
 * A `height:auto` text box's intrinsic height. When `textSizing` (real
 * HarfBuzz-measured, from `prepareHtmlTextSizing()`) has an entry for this
 * exact (text, font, content-width) combination, use it - otherwise fall
 * back to a character-count heuristic (`fontSize * 0.55` average glyph
 * width) that only approximates real text shaping. See text-sizing.ts for
 * why a cache miss here is always safe, never wrong.
 */
function estimateTextIntrinsicHeight(text: string, style: Style, fontSize: number, containingWidth: number, viewport: CssViewport, textSizing: HtmlTextSizingLookup | undefined): number {
  const lineHeight = parseLineHeight(style, fontSize, viewport);
  const lineClamp = parseLineClamp(style);
  const cap = (lines: number) => lineClamp !== undefined ? Math.min(lines, lineClamp) : lines;
  const whiteSpace = parseWhiteSpace(style.get("white-space"));
  const explicitLines = text.split(/\r?\n/);
  if (whiteSpace === "nowrap" || whiteSpace === "pre") return cap(Math.max(1, explicitLines.length)) * lineHeight;

  const contentWidth = resolveTextContentWidth(style, containingWidth, fontSize, viewport);
  if (textSizing) {
    const measured = textSizing.get(textSizingCacheKey(text, style, fontSize, contentWidth));
    // The probe measures natural (unclamped) wrapped height; -webkit-line-clamp
    // still caps it here rather than needing its own probe variant.
    if (measured) return lineClamp !== undefined ? Math.min(measured.height, lineClamp * lineHeight) : measured.height;
  }
  const averageGlyphWidth = Math.max(1, fontSize * 0.55);
  const charactersPerLine = Math.max(1, Math.floor(contentWidth / averageGlyphWidth));
  const normalizedLines = text.replace(/[ \t]+/g, " ").split(/\r?\n/);
  const lineCount = normalizedLines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  return cap(Math.max(1, lineCount)) * lineHeight;
}

export type ContainingBlock = LayoutRect;

export type NodeBoxDeps = {
  styles: Map<Node, Style>;
  rules: Rule[];
  viewport: CssViewport;
  textSizing: HtmlTextSizingLookup | undefined;
  anchorBoxes: Map<string, LayoutRect>;
  layoutOverrides: Map<Node, LayoutOverride>;
};

export type ResolvedNodeBox = {
  style: Style;
  font: number;
  parentFont: number;
  firstChildMarginConsumed: number;
  geometry: ResolvedGeometry;
  layoutBox: LayoutBox;
  x: number;
  y: number;
  width: number;
  height: number;
  normalX: number;
  normalY: number;
};

/**
 * Resolves a single node's box (position + size, plus everything
 * `resolveGeometry` needs to get there: margin-collapse-with-first-child and
 * `height:auto` intrinsic sizing). This is the seam a future Chrome-measured
 * layout snapshot (see the layout-geometry-diff spike) would plug into -
 * everything here is "compute this node's own geometry", nothing here emits
 * paint/border/text/animation layers or recurses into children.
 */
export function createNodeBoxResolver(deps: NodeBoxDeps) {
  const { styles, rules, viewport, textSizing, anchorBoxes, layoutOverrides } = deps;

  // CSS collapses an adjoining top margin between a block container and its
  // first in-flow child onto the container itself, provided the container
  // has no top border/padding, doesn't establish a new block formatting
  // context, and isn't itself out of flow. `blocksTopMarginCollapse` mirrors
  // that gate; `firstInFlowChildTopMargin` finds the margin to collapse
  // with, recursing through `display: contents` wrappers and skipping
  // out-of-flow/`display: none` children (which generate no box to collapse
  // through).
  const blocksTopMarginCollapse = (style: Style, paddingTop: number, borderTopWidth: number): boolean => {
    if (paddingTop > 0 || borderTopWidth > 0) return true;
    const overflow = (style.get("overflow") ?? style.get("overflow-y") ?? "visible").trim().toLowerCase();
    if (overflow !== "visible") return true;
    const display = (style.get("display") ?? "block").trim().toLowerCase();
    if (display === "flex" || display === "inline-flex" || display === "grid" || display === "inline-grid") return true;
    const position = (style.get("position") ?? "static").trim().toLowerCase();
    return position === "absolute" || position === "fixed";
  };
  const firstInFlowChildTopMargin = (children: Node[], parentStyle: Style, containingWidth: number): number | undefined => {
    for (const child of children) {
      const childStyle = styles.get(child) ?? parentStyle;
      const display = (childStyle.get("display") ?? "block").trim().toLowerCase();
      if (display === "none") continue;
      const childPosition = (childStyle.get("position") ?? "static").trim().toLowerCase();
      if (childPosition === "absolute" || childPosition === "fixed") continue;
      if (display === "contents") {
        const nested = firstInFlowChildTopMargin(child.children, childStyle, containingWidth);
        if (nested !== undefined) return nested;
        continue;
      }
      const childFont = number(childStyle, "font-size", containingWidth, 16, 16, viewport) || 16;
      return edges(childStyle, "margin", containingWidth, childFont, 16, viewport)[0];
    }
    return undefined;
  };
  // Shared by `resolveNodeBox` (to shift the box itself when its own top
  // margin collapses through) and by the auto-height estimator below (which
  // needs the same "does the first child's margin land inside or outside me"
  // answer to predict where flowLayout will actually place that child).
  const collapseWithFirstChild = (style: Style, children: Node[], containingWidth: number, font: number): { topMarginOverride: number | undefined; firstChildMarginConsumed: number } => {
    const ownPaddingTop = edges(style, "padding", containingWidth, font, 16, viewport)[0];
    const ownBorderTopWidth = parseBorderEdges(style, containingWidth, font, viewport).top.width;
    if (blocksTopMarginCollapse(style, ownPaddingTop, ownBorderTopWidth)) return { topMarginOverride: undefined, firstChildMarginConsumed: 0 };
    const firstChildTopMargin = firstInFlowChildTopMargin(children, style, containingWidth);
    if (firstChildTopMargin === undefined) return { topMarginOverride: undefined, firstChildMarginConsumed: 0 };
    const ownMarginTop = edges(style, "margin", containingWidth, font, 16, viewport)[0];
    return { topMarginOverride: collapseVerticalMargins(ownMarginTop, firstChildTopMargin), firstChildMarginConsumed: firstChildTopMargin };
  };
  // A block container with `height: auto` shrink-wraps the flow height of
  // its in-flow children. Text containers already get this from the text
  // measurer; this mirrors the same idea for element children by predicting
  // what `layoutFlowChildren` would compute, without emitting any layers.
  // Flex/grid/svg containers size their children through a different
  // algorithm and are intentionally left out of this estimate.
  const estimateChildBorderBoxHeight = (child: Node, childStyle: Style, containingWidth: number, parentFont: number): number => {
    const childFont = number(childStyle, "font-size", containingWidth, parentFont, 16, viewport) || parentFont;
    const declaredHeight = number(childStyle, "height", Number.POSITIVE_INFINITY, childFont, 16, viewport);
    const boxSizing = (childStyle.get("box-sizing") ?? "content-box").trim().toLowerCase();
    const padding = edges(childStyle, "padding", containingWidth, childFont, 16, viewport);
    const border = parseBorderEdges(childStyle, containingWidth, childFont, viewport);
    const verticalDecorations = padding[0] + padding[2] + border.top.width + border.bottom.width;
    if (Number.isFinite(declaredHeight)) return Math.max(1, declaredHeight + (boxSizing === "content-box" ? verticalDecorations : 0));
    const text = isTextFlowNode(child) ? normalizeTextContent(collectTextContentWithBreaks(child), true).text : child.text.normalize("NFC").trim();
    const display = (childStyle.get("display") ?? "block").trim().toLowerCase();
    const isBlockFlowContainer = child.tag !== "svg" && child.tag !== "g" && display !== "flex" && display !== "inline-flex" && display !== "grid" && display !== "inline-grid";
    let contentHeight = 0;
    if (text) {
      contentHeight = estimateTextIntrinsicHeight(text, childStyle, childFont, containingWidth, viewport, textSizing);
    } else if (isBlockFlowContainer && child.children.length > 0) {
      const horizontalDecorations = padding[1] + padding[3] + border.right.width + border.left.width;
      const childContentWidth = Math.max(1, containingWidth - horizontalDecorations);
      const collapse = collapseWithFirstChild(childStyle, child.children, childContentWidth, childFont);
      contentHeight = Math.max(0, flowContentHeight(child.children, childStyle, childContentWidth, childFont, collapse.topMarginOverride === undefined ? 0 : -collapse.firstChildMarginConsumed));
    }
    return Math.max(1, contentHeight + (boxSizing === "border-box" ? verticalDecorations : 0));
  };
  const flowContentHeight = (children: Node[], parentStyle: Style, containingWidth: number, parentFont: number, startFlowY: number): number => {
    let flowY = startFlowY;
    let hasFlowChild = false;
    let previousBottomMargin = 0;
    for (const child of children) {
      const childStyle = styles.get(child) ?? parentStyle;
      const display = (childStyle.get("display") ?? "block").trim().toLowerCase();
      if (display === "none") continue;
      if (display === "contents") {
        flowY = flowContentHeight(child.children, childStyle, containingWidth, parentFont, flowY);
        continue;
      }
      if ((childStyle.get("position") ?? "static").trim().toLowerCase() === "absolute") continue;
      const childFont = number(childStyle, "font-size", containingWidth, parentFont, 16, viewport) || parentFont;
      const childMargin = edges(childStyle, "margin", containingWidth, childFont, 16, viewport);
      const collapsedMargin = hasFlowChild ? collapseVerticalMargins(previousBottomMargin, childMargin[0]) : childMargin[0];
      const childY = flowY - childMargin[0] + collapsedMargin;
      flowY = childY + estimateChildBorderBoxHeight(child, childStyle, containingWidth, childFont);
      previousBottomMargin = childMargin[2];
      hasFlowChild = true;
    }
    return flowY;
  };

  function resolveNodeBox(node: Node, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style, positionedBlock: ContainingBlock): ResolvedNodeBox {
    const authoredStyle = styles.get(node) ?? computed(node, rules, parentStyle);
    const style = resolveAnchorStyle(authoredStyle, positionedBlock, anchorBoxes);
    const parentFont = number(parentStyle, "font-size", containingWidth, 16, 16, viewport) || 16;
    const font = number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont;
    // Adjoining-margin collapse between this box and its first in-flow
    // child (single level only — does not chase the collapse through a
    // grandchild when the first child itself has zero padding/border).
    let firstChildMarginConsumed = 0;
    let topMarginOverride: number | undefined;
    if (node.tag !== "body" && node.tag !== "html" && node.children.length > 0) {
      const collapse = collapseWithFirstChild(style, node.children, containingWidth, font);
      topMarginOverride = collapse.topMarginOverride;
      firstChildMarginConsumed = collapse.firstChildMarginConsumed;
    }
    const nodeTextContent = isTextFlowNode(node) ? normalizeTextContent(collectTextContentWithBreaks(node), true) : { text: node.text.normalize("NFC").trim(), hardBreaks: [] };
    const geometryText = nodeTextContent.text;
    const heightIsAuto = node.tag !== "body" && (!Number.isFinite(number(style, "height", containingHeight, font, 16, viewport)) || style.get("height")?.trim().toLowerCase() === "auto");
    const ownDisplayForHeight = (style.get("display") ?? "block").trim().toLowerCase();
    const isBlockFlowContainer = node.tag !== "svg" && node.tag !== "g" && ownDisplayForHeight !== "flex" && ownDisplayForHeight !== "inline-flex" && ownDisplayForHeight !== "grid" && ownDisplayForHeight !== "inline-grid";
    let intrinsicContentHeight: number | undefined;
    if (heightIsAuto && geometryText) {
      intrinsicContentHeight = estimateTextIntrinsicHeight(geometryText, style, font, containingWidth, viewport, textSizing);
    } else if (heightIsAuto && isBlockFlowContainer && node.children.length > 0) {
      const ownPadding = edges(style, "padding", containingWidth, font, 16, viewport);
      const ownBorder = parseBorderEdges(style, containingWidth, font, viewport);
      const ownHorizontalDecorations = ownPadding[1] + ownPadding[3] + ownBorder.right.width + ownBorder.left.width;
      const declaredOwnWidth = number(style, "width", containingWidth, font, 16, viewport);
      const ownBoxSizing = (style.get("box-sizing") ?? "content-box").trim().toLowerCase();
      const ownContentWidth = Number.isFinite(declaredOwnWidth)
        ? Math.max(1, ownBoxSizing === "border-box" ? declaredOwnWidth - ownHorizontalDecorations : declaredOwnWidth)
        : Math.max(1, containingWidth - ownHorizontalDecorations);
      intrinsicContentHeight = Math.max(0, flowContentHeight(node.children, style, ownContentWidth, font, topMarginOverride === undefined ? 0 : -firstChildMarginConsumed));
    }
    const baseGeometry = resolveGeometry({ style, parentX, parentY, containingWidth, containingHeight, fontSize: font, viewport, ...(intrinsicContentHeight === undefined ? {} : { intrinsicContentHeight }), ...(topMarginOverride === undefined ? {} : { topMarginOverride }) });
    const geometry = layoutOverrides.has(node) ? resizeResolvedGeometry(baseGeometry, layoutOverrides.get(node)!) : baseGeometry;
    const layoutBox = assertLayoutBox(geometry.layoutBox);
    const { x, y, width, height } = layoutBox;
    const { normalX, normalY } = geometry;
    return { style, font, parentFont, firstChildMarginConsumed, geometry, layoutBox, x, y, width, height, normalX, normalY };
  }

  return { resolveNodeBox };
}
