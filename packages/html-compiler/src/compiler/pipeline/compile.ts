import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import {
  DEFAULT_HTML_CSS_COMPOSITION,
  type HtmlCssProject,
  type HtmlCompilerOptions,
  type HtmlCompilerResult,
  type HtmlTextSizingLookup,
  type NeonixHtmlProjectConfig,
  type HtmlCssSource,
  type HtmlDocumentInput,
} from "../../source";
import { resolveTextContentWidth, textSizingCacheKey } from "../text-sizing";
import { CompileError, CompileIssues, fail } from "../errors";
import { neonixManifest, withoutNeonixManifest } from "../html/manifest";
import { parseHtml } from "../html/parser";
import { parseAnimationStyles, parseRules } from "../css/parser";
import { computed } from "../css/cascade";
import { edges, number, resolveVar } from "../css/values";
import { parseBorderEdges, parseColor, parseCornerRadii, parseOutline, parsePaintLayers, type Paint } from "../paint";
import { resolveNodeTransformState } from "../transform";
import { resolveGeometry, resizeResolvedGeometry } from "../geometry";
import { collapseVerticalMargins } from "../layout";
import { assertLayoutBox, compositionRect, paddingBox, type LayoutRect } from "../layout-ir";
import { createLayoutEngine, layoutFlowChildren, type FlowState } from "../layout/engine";
import { resolveFlexLayout } from "../flex";
import { resolveGridLayout } from "../grid";
import { mediaSource, parseImageFit, parseImageRendering, parseObjectPosition } from "../lowering/media";
import { parseBackgroundPosition, parseBackgroundRepeat, parseBackgroundSize, parseMaskImages } from "../background";
import { parseFilter } from "../filter";
import { resolveNodeBackground, resolveNodeClipPath, resolveNodeOutline, resolveNodePaintEffects, resolveNodeSvgPath, resolveNodeTextPayload } from "./resolve-node";
import { emitNodePaint } from "./paint-node";
import { emitNodeBorder } from "./border-node";
import { parseLineHeight, parseWhiteSpace } from "../css/typography";
import { splitTopLevel } from "../utils";
import { animationTimelineDuration, resolveNodeAnimationTracks } from "../css/animation";
import { motionPathLength, parseMotionPath } from "../motion-path";
import { parseAnchorNames, resolveAnchorStyle } from "../anchor";
import { classifyNode, collectTextContentWithBreaks, isTextFlowNode, normalizeTextContent } from "../lowering/dispatcher";
import type { Node, Style } from "../model";
import { createCompileContext } from "../compile-context";
import { createAssetRegistry } from "../lowering/assets";
import { parseNeonixDocument, isCompileError } from "../document";

/**
 * A `height:auto` text box's intrinsic height. When `textSizing` (real
 * HarfBuzz-measured, from `prepareHtmlTextSizing()`) has an entry for this
 * exact (text, font, content-width) combination, use it - otherwise fall
 * back to a character-count heuristic (`fontSize * 0.55` average glyph
 * width) that only approximates real text shaping. See text-sizing.ts for
 * why a cache miss here is always safe, never wrong.
 */
function estimateTextIntrinsicHeight(text: string, style: Style, fontSize: number, containingWidth: number, viewport: { width: number; height: number }, textSizing: HtmlTextSizingLookup | undefined): number {
  const lineHeight = parseLineHeight(style, fontSize, viewport);
  const whiteSpace = parseWhiteSpace(style.get("white-space"));
  const explicitLines = text.split(/\r?\n/);
  if (whiteSpace === "nowrap" || whiteSpace === "pre") return Math.max(1, explicitLines.length) * lineHeight;

  const contentWidth = resolveTextContentWidth(style, containingWidth, fontSize, viewport);
  if (textSizing) {
    const measured = textSizing.get(textSizingCacheKey(text, style, fontSize, contentWidth));
    if (measured) return measured.height;
  }
  const averageGlyphWidth = Math.max(1, fontSize * 0.55);
  const charactersPerLine = Math.max(1, Math.floor(contentWidth / averageGlyphWidth));
  const normalizedLines = text.replace(/[ \t]+/g, " ").split(/\r?\n/);
  const lineCount = normalizedLines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  return Math.max(1, lineCount) * lineHeight;
}

/**
 * Compile the canonical file-oriented project contract. The caller owns file
 * I/O; this API deliberately receives the already loaded HTML, CSS and config.
 */
export function compileProject(project: HtmlCssProject, options: HtmlCompilerOptions = {}): HtmlCompilerResult {
  const source = {
    kind: "neonix-html-source" as const,
    sourceSchemaVersion: 1 as const,
    composition: project.config.composition,
    html: project.html,
    css: project.css,
  };
  return compileSource(source, options, project.config);
}

/**
 * Compile the canonical single-file HTML document contract. The document
 * carries composition metadata in meta[name="neonix-document"] and CSS in
 * one or more inline style resources.
 */
export function compileDocument(document: HtmlDocumentInput, options: HtmlCompilerOptions = {}): HtmlCompilerResult {
  const fallbackSource: HtmlCssSource = {
    kind: "neonix-html-source",
    sourceSchemaVersion: 1,
    composition: { ...DEFAULT_HTML_CSS_COMPOSITION },
    html: document.html,
    css: "",
  };
  try {
    const parsed = parseNeonixDocument(document);
    const documentOptions: HtmlCompilerOptions = {
      ...options,
      ...(document.fontAssets === undefined ? {} : { fontAssets: document.fontAssets }),
      ...(document.mediaAssets === undefined ? {} : { mediaAssets: document.mediaAssets }),
    };
    return compileSource({
      kind: "neonix-html-source",
      sourceSchemaVersion: 1,
      composition: parsed.composition,
      html: parsed.html,
      css: parsed.css,
    }, documentOptions);
  } catch (error) {
    if (error instanceof CompileIssues) {
      const diagnostics = error.issues.map((issue) => ({ severity: "error" as const, code: issue.code, message: issue.message }));
      return { status: "error", source: fallbackSource, protocol: null, diagnostics };
    }
    const diagnostic = isCompileError(error)
      ? { severity: "error" as const, code: error.code, message: error.message, ...(error.source ? { source: error.source } : {}) }
      : { severity: "error" as const, code: "html-compiler-internal", message: error instanceof Error ? error.message : String(error) };
    return { status: "error", source: fallbackSource, protocol: null, diagnostics: [diagnostic] };
  }
}

/** @deprecated Use compileProject({ html, css, config }) for new projects. */
export function compileHtmlCss(source: HtmlCssSource, options: HtmlCompilerOptions = {}): HtmlCompilerResult {
  return compileSource(source, options);
}

function compileSource(source: HtmlCssSource, options: HtmlCompilerOptions = {}, projectConfig?: NeonixHtmlProjectConfig): HtmlCompilerResult {
  try {
    if (projectConfig && (projectConfig.kind !== "neonix-html-project" || projectConfig.schemaVersion !== 1)) {
      fail("html-config-invalid", "neonix.config.json must be a Neonix HTML project config");
    }
    const composition = validateComposition(source.composition ?? DEFAULT_HTML_CSS_COMPOSITION);
    const embeddedComposition = neonixManifest(source.html);
    if (embeddedComposition && !sameComposition(composition, embeddedComposition)) {
      fail("html-composition-mismatch", "Embedded neonix-manifest composition must match neonix.config.json");
    }
    const width = composition.width; const height = composition.height; const fps = composition.fps; const baseDuration = options.composition?.durationMs ?? composition.durationMs ?? 1000; const root = parseHtml(withoutNeonixManifest(source.html)); const parsedStylesheet = parseAnimationStyles(source.css); const rules = parseRules(parsedStylesheet.css); const keyframes = parsedStylesheet.keyframes; const viewport = { width, height }; const findNode = (node: Node, tag: string): Node | undefined => node.tag === tag ? node : node.children.map((child) => findNode(child, tag)).find(Boolean); const body = findNode(root, "body"); const rootVars = new Map<string, string>(); for (const rule of rules) if (rule.selectors.some((selector) => selector.trim() === ":root")) for (const declaration of rule.declarations) if (declaration.property.startsWith("--")) rootVars.set(declaration.property, declaration.value);
    const allNodes: Node[] = []; const visit = (node: Node) => { allNodes.push(node); node.children.forEach(visit); }; root.children.forEach(visit); const styles = new Map<Node, Style>();
    const walkStyles = (node: Node, parent: Style) => { const style = computed(node, rules, parent); const scopedVars = new Map<string, string>(); for (const [property, value] of style) if (property.startsWith("--")) scopedVars.set(property, value); for (const [property, value] of [...style]) { const resolved = resolveVar(value, scopedVars, new Set()); style.set(property, resolved); if (property.startsWith("--")) scopedVars.set(property, resolved); } const currentColor = style.get("color") ?? parent.get("color") ?? "#000000"; for (const [property, value] of style) { if (property === "background" || property === "background-color") parsePaintLayers(value, property, currentColor); else if (property === "mask-image") parseMaskImages(style, currentColor, { width, height }); else if (property === "border-color") { for (const sideColor of splitTopLevel(value.replace(/\s+/g, " ").trim(), " ")) parseColor(sideColor, property, currentColor); } else if (property === "color" || property === "fill" || property === "stroke") { if (!(property === "fill" || property === "stroke") || value.toLowerCase() !== "none") parseColor(value, property, currentColor); } } styles.set(node, style); node.children.forEach((child) => walkStyles(child, style)); }; if (body) walkStyles(body, rootVars); else root.children.forEach((child) => walkStyles(child, rootVars));
    if (body && !styles.has(body)) styles.set(body, computed(body, rules, new Map())); const duration = Math.max(baseDuration, ...[...styles.values()].map(animationTimelineDuration)); const bodyStyle = body ? styles.get(body)! : new Map<string, string>(); const backgroundColor = parseColor(composition.background, "composition background");
    type ContainingBlock = LayoutRect;
    const context = createCompileContext({ source, options, composition, root, body: body ?? null, rules, keyframes, styles, width, height, fps, baseDuration, viewport });
    const { layers, assets, audioTracks, clipPaths, masks } = context;
    const { origins, flowOrigins, sizes, anchorBoxes } = context.layout;
    const layoutEngine = createLayoutEngine(context.layout);
    const assetRegistry = createAssetRegistry(options, assets);
    const mediaAsset = (node: Node, kind: "image" | "video" | "audio", uri: string, suffix = "asset") => assetRegistry.registerMedia(node, kind, uri, suffix);
    const maskSourceStyle = (style: Style, index: number): Style => new Map([
      ["background-position", maskListValue(style.get("mask-position"), index, "0% 0%")],
      ["background-size", maskListValue(style.get("mask-size"), index, "auto")],
      ["background-repeat", maskListValue(style.get("mask-repeat"), index, "repeat")],
    ]);
    const maskListValue = (value: string | undefined, index: number, fallback: string): string => {
      const values = splitTopLevel(value ?? fallback, ",").map((item) => item.trim()).filter(Boolean);
      return values[index] ?? values[values.length - 1] ?? fallback;
    };
    const parseMaskMode = (style: Style, index: number): "alpha" | "luminance" => {
      const value = maskListValue(style.get("mask-mode"), index, "alpha").toLowerCase();
      if (value !== "alpha" && value !== "luminance") fail("css-mask-mode-unsupported", `Unsupported mask-mode value: ${value}`);
      return value as "alpha" | "luminance";
    };
    const parseMaskComposite = (style: Style, index: number): "add" | "subtract" | "intersect" | "exclude" => {
      const value = maskListValue(style.get("mask-composite"), index, "add").toLowerCase();
      if (!["add", "subtract", "intersect", "exclude"].includes(value)) fail("css-mask-composite-unsupported", `Unsupported mask-composite value: ${value}`);
      return value as "add" | "subtract" | "intersect" | "exclude";
    };
    const lowerMaskImages = (node: Node, style: Style, currentColor: string, targetWidth: number, targetHeight: number): NonNullable<MotionProtocolV2["layers"][number]["maskLayers"]> | undefined => {
      const images = parseMaskImages(style, currentColor, { width: targetWidth, height: targetHeight });
      if (images.length === 0) return undefined;
      const maskRefs: Array<{ maskIds: string[]; mode: "alpha" | "luminance"; composite: "add" | "subtract" | "intersect" | "exclude" }> = [];
      images.forEach((image, imageIndex) => {
        const mode = parseMaskMode(style, imageIndex);
        // CSS has one composite operator between each pair of mask layers;
        // a stack of N images therefore consumes N - 1 values. The first
        // layer establishes the initial coverage and does not consume one.
        const composite = imageIndex === 0 ? "add" : parseMaskComposite(style, imageIndex - 1);
        const sourceStyle = maskSourceStyle(style, imageIndex);
        const position = parseBackgroundPosition(sourceStyle, 0);
        const size = parseBackgroundSize(sourceStyle, 0, targetWidth, targetHeight, viewport);
        const repeat = parseBackgroundRepeat(sourceStyle, 0);
        const origin = { x: 0, y: 0, width: targetWidth, height: targetHeight };
        const drawWidth = size.type === "length" ? Math.max(1, size.width) : origin.width;
        const drawHeight = size.type === "length" ? Math.max(1, size.height) : origin.height;
        const startX = origin.x + (origin.width - drawWidth) * position.x;
        const startY = origin.y + (origin.height - drawHeight) * position.y;
        const xRepeats = repeat === "repeat" || repeat === "repeat-x";
        const yRepeats = repeat === "repeat" || repeat === "repeat-y";
        if ((xRepeats || yRepeats) && size.type !== "length") fail("css-mask-repeat-needs-size", "Repeating a CSS mask requires an explicit two-dimensional mask-size");
        const xStart = xRepeats ? Math.floor((origin.x - startX) / drawWidth) - 1 : 0;
        const xEnd = xRepeats ? Math.ceil((origin.x + origin.width - startX) / drawWidth) + 1 : 0;
        const yStart = yRepeats ? Math.floor((origin.y - startY) / drawHeight) - 1 : 0;
        const yEnd = yRepeats ? Math.ceil((origin.y + origin.height - startY) / drawHeight) + 1 : 0;
        const tileCount = Math.max(1, xEnd - xStart + 1) * Math.max(1, yEnd - yStart + 1);
        if (tileCount > 4096) fail("css-mask-repeat-too-many-tiles", "mask-repeat would generate more than 4096 deterministic tiles");
        const maskIds: string[] = [];
        if (image.type === "paint" || image.type === "color") {
          const children: Array<{ type: "rect"; x: number; y: number; width: number; height: number; fill: Paint; fillOpacity?: number }> = [];
          const fill = image.type === "paint" ? image.paint : image.color;
          let tileIndex = 0;
          for (let xTile = xStart; xTile <= xEnd; xTile += 1) for (let yTile = yStart; yTile <= yEnd; yTile += 1) {
            if (xRepeats || yRepeats || tileIndex === 0) children.push({ type: "rect", x: startX + (xRepeats ? xTile * drawWidth : 0), y: startY + (yRepeats ? yTile * drawHeight : 0), width: drawWidth, height: drawHeight, fill, ...(image.opacity === undefined ? {} : { fillOpacity: image.opacity }) });
            tileIndex += 1;
          }
          const id = `${node.atomicId}-mask-${imageIndex}`;
          masks.push({ id, maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse", maskType: mode, children });
          maskIds.push(id);
        } else {
          let tileIndex = 0;
          for (let xTile = xStart; xTile <= xEnd; xTile += 1) for (let yTile = yStart; yTile <= yEnd; yTile += 1) {
            if (xRepeats || yRepeats || tileIndex === 0) {
              const id = `${node.atomicId}-mask-${imageIndex}-${tileIndex}`;
              masks.push({ id, maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse", maskType: mode, image: { type: "image", assetId: mediaAsset(node, "image", image.uri, `mask-${imageIndex}-${tileIndex}-asset`), x: startX + (xRepeats ? xTile * drawWidth : 0), y: startY + (yRepeats ? yTile * drawHeight : 0), width: drawWidth, height: drawHeight, fit: "fill", ...(image.opacity === undefined ? {} : { opacity: image.opacity }) } });
              maskIds.push(id);
            }
            tileIndex += 1;
          }
        }
        maskRefs.push({ maskIds, mode, composite });
      });
      return maskRefs;
    };
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
    // Shared by `layout()` (to shift the box itself when its own top margin
    // collapses through) and by the auto-height estimator below (which needs
    // the same "does the first child's margin land inside or outside me"
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
        contentHeight = estimateTextIntrinsicHeight(text, childStyle, childFont, containingWidth, viewport, options.textSizing);
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
    const flowLayout = (children: Node[], parent: Node | null, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style, positionedBlock: ContainingBlock, state: FlowState): void => layoutFlowChildren({
      children,
      parent,
      parentX,
      parentY,
      containingWidth,
      containingHeight,
      parentStyle,
      positionedBlock,
      state,
      styles,
      margin: (style, availableWidth, ownerStyle) => edges(style, "margin", availableWidth, number(ownerStyle, "font-size", availableWidth, 16, 16, viewport) || 16, 16, viewport),
      layout,
      flowOrigin: (node) => flowOrigins.get(node),
      size: (node) => sizes.get(node),
    });
    const svgLayout = (children: Node[], parent: Node, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style, positionedBlock: ContainingBlock): void => {
      for (const child of children) {
        const childStyle = styles.get(child) ?? parentStyle;
        if (childStyle.get("display") === "contents") {
          svgLayout(child.children, parent, parentX, parentY, containingWidth, containingHeight, childStyle, positionedBlock);
          continue;
        }
        const childPosition = childStyle.get("position") ?? "static";
        if (childPosition === "absolute") {
          layout(child, parent, positionedBlock.x, positionedBlock.y, positionedBlock.width, positionedBlock.height, parentStyle, positionedBlock);
        } else {
          // SVG child geometry is expressed in the parent's user coordinate
          // space. Do not apply HTML block-flow stacking between primitives.
          layout(child, parent, parentX, parentY, containingWidth, containingHeight, parentStyle, positionedBlock);
        }
      }
    };
    function layout(node: Node, parent: Node | null, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style, positionedBlock: ContainingBlock): void {
      // Inline text descendants are already collected by their nearest text
      // layer. They must not become independent layers or resolve their own
      // default font/geometry.
      if (parent !== null && isTextFlowNode(parent) && isTextFlowNode(node)) return;
      const authoredStyle = styles.get(node) ?? computed(node, rules, parentStyle); const style = resolveAnchorStyle(authoredStyle, positionedBlock, anchorBoxes); const parentFont = number(parentStyle, "font-size", containingWidth, 16, 16, viewport) || 16; const font = number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont;
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
        intrinsicContentHeight = estimateTextIntrinsicHeight(geometryText, style, font, containingWidth, viewport, options.textSizing);
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
      const baseGeometry = resolveGeometry({ style, parentX, parentY, containingWidth, containingHeight, fontSize: font, viewport, ...(intrinsicContentHeight === undefined ? {} : { intrinsicContentHeight }), ...(topMarginOverride === undefined ? {} : { topMarginOverride }) }); const geometry = layoutEngine.state.layoutOverrides.has(node) ? resizeResolvedGeometry(baseGeometry, layoutEngine.state.layoutOverrides.get(node)!) : baseGeometry; const layoutBox = assertLayoutBox(geometry.layoutBox); const { x, y, width: w, height: h } = layoutBox; const { normalX, normalY } = geometry;
      const loweringKind = classifyNode(node);
      layoutEngine.record(node, layoutBox, normalX, normalY);
      for (const name of parseAnchorNames(style)) {
        if (!layoutEngine.registerAnchor(name, layoutBox)) fail("css-anchor-name-duplicate", `anchor-name is already registered in this composition: ${name}`);
      }
      if (style.get("display") === "none") return;
      if (style.get("display") === "contents") { node.children.forEach((child) => layout(child, parent, parentX, parentY, containingWidth, containingHeight, parentStyle, positionedBlock)); return; }
      if (node.tag !== "body" && style.get("display") !== "none" && w > 0 && h > 0) {
        const opacityValue = style.get("opacity")?.trim(); const opacity = opacityValue === undefined ? 1 : opacityValue.endsWith("%") ? Number(opacityValue.slice(0, -1)) / 100 : Number(opacityValue); if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) fail("css-opacity-invalid", `opacity must be between 0 and 1: ${opacityValue}`);
        const parentIsLayer = parent !== null && parent !== undefined && parent.tag !== "body"; const parentId = parentIsLayer ? (parent.atomicId ?? null) : null; const groupId = node.atomicId; const hasChildren = node.children.length > 0; const localX = parentIsLayer && parent.children.length ? x - (origins.get(parent)?.x ?? parentX) : x; const localY = parentIsLayer && parent.children.length ? y - (origins.get(parent)?.y ?? parentY) : y;
        const zIndexValue = style.get("z-index"); const zIndex = zIndexValue === undefined || zIndexValue === "auto" ? undefined : Number(zIndexValue); const layerOrder = Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : layers.length; const state = style.get("visibility") === "hidden" ? { enabled: false } : {};
        const cornerRadius = parseCornerRadii(style, w, h, font, viewport);
        const currentColor = style.get("color") ?? parentStyle.get("color") ?? "#000000";
        const backdropFilterEffects = parseFilter(style.get("backdrop-filter"), containingWidth, font, viewport, currentColor);
        const backdropState = backdropFilterEffects.length ? { backdropEffects: backdropFilterEffects } : {};
        const { registerClipPath, elementClipPath } = resolveNodeClipPath({ style, width: w, height: h, viewport, geometry, cornerRadius, hasChildren, hasBackdropFilter: backdropFilterEffects.length > 0, clipPaths });
         const motion = parseMotionPath(style, w, h, font, viewport);
         const { perspective, render3d, backfaceVisibility, transformFor } = resolveNodeTransformState(style, w, h, font, viewport, hasChildren);
         const outline = parseOutline(style, containingWidth, font, viewport);
         const animationTracks = resolveNodeAnimationTracks(style, keyframes, {
           width: w,
           height: h,
           fontSize: font,
           viewport,
           currentColor,
           layoutTranslate: { x: localX, y: localY },
           containingWidth,
           containingHeight,
           baseFrame: { width: w, height: h },
           boxSizing: geometry.boxSizing,
           frameDecorations: { width: Math.max(0, w - geometry.contentWidth), height: Math.max(0, h - geometry.contentHeight) },
           motionPathLength: motion ? motionPathLength(motion.offsetPath.contours) : undefined,
           perspective,
         });
         const { paintAnimationTracks, borderAnimationTracks } = animationTracks;
         const { textShadows, paintEffects, compositeState, compositeNeedsGroup } = resolveNodePaintEffects(style, containingWidth, font, viewport, currentColor);
         const { hasOutline, emitOutline } = resolveNodeOutline({ outline, cornerRadius, width: w, height: h, groupId, parentId, localX, localY, zIndex, opacity, state, duration, transformFor, layers });
         const maskLayerRefs = lowerMaskImages(node, style, style.get("color") ?? parentStyle.get("color") ?? "#000000", w, h);
        if (loweringKind === "image") {
           const source = mediaSource(node);
           const fit = parseImageFit(style);
           const align = parseObjectPosition(style);
           const imageRendering = parseImageRendering(style);
           const imageAspect = fit === "fill"
             ? { align: "none" as const }
             : { align, ...(fit === "cover" ? { meetOrSlice: "slice" as const } : fit === "contain" ? { meetOrSlice: "meet" as const } : {}) };
            const clipPathId = elementClipPath();
            layers.push({ id: groupId, type: "image", parentLayerId: parentId, order: layers.length, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...backdropState, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(paintEffects.length ? { effects: paintEffects } : {}), ...(animationTracks.group.length ? { tracks: animationTracks.group } : {}), timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "image", source), x: 0, y: 0, width: w, height: h, fit, preserveAspectRatio: imageAspect, ...(imageRendering ? { imageRendering } : {}) } });
           emitOutline(false);
           return;
         }
          if (loweringKind === "video") {
            const source = mediaSource(node);
            const fit = parseImageFit(style);
             const clipPathId = elementClipPath();
            layers.push({ id: groupId, type: "video", parentLayerId: parentId, order: layers.length, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...backdropState, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(paintEffects.length ? { effects: paintEffects } : {}), ...(animationTracks.group.length ? { tracks: animationTracks.group } : {}), timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "video", source), fit } });
            emitOutline(false);
            return;
          }
          if (loweringKind === "audio") {
            const source = mediaSource(node);
            const assetId = mediaAsset(node, "audio", source);
            const catalog = options.mediaAssets?.find((asset) => asset.uri === source && asset.kind === "audio");
            const clipDuration = Math.max(1, catalog?.duration ?? baseDuration);
            audioTracks.push({
              id: groupId,
              gainDb: 0,
              pan: 0,
              muted: false,
              clips: [{
                id: `${groupId}::clip`,
                assetId,
                timing: { start: 0, duration: clipDuration },
                trim: { start: 0, end: clipDuration },
                playbackRate: 1,
                enabled: true,
                gainDb: 0,
                pan: 0,
              }],
            });
            return;
          }
          const { textPayload, textClipId, authoredTextGradient } = resolveNodeTextPayload({
            node, style, parentStyle, styles, hasChildren, groupId,
            width: w, height: h, containingWidth, viewport,
            parentFontSize: parentFont, geometry,
            fontAssets: options.fontAssets ?? [],
            assetRegistry, registerClipPath, elementClipPath,
          });
          const { backgroundValue, paints, border, backgroundImages, boxFor, paintBoxFor, borderBox, hasBorder, hasSizedGradientBackground } = resolveNodeBackground({ node, style, parentStyle, width: w, height: h, containingWidth, fontSize: font, viewport, geometry, hasChildren, authoredTextGradient });
         const { isPath, pathContours, pathStyle, fillRuleValue } = resolveNodeSvgPath(node, style, parentStyle);
         if (isPath) {
           const styleForPath = pathStyle?.fill === "none"
             ? { ...(pathStyle ?? {}), fill: "none" as const }
             : pathStyle?.fill || pathStyle?.stroke
               ? pathStyle
               : { ...(pathStyle ?? {}), fill: "#000000" };
           if (styleForPath.fill && styleForPath.fill !== "none" && pathContours!.some((contour) => !contour.closed)) fail("svg-path-fill-open", "Filled SVG paths must close every contour with Z");
           const clipPathId = elementClipPath();
           layers.push({ id: groupId, type: "path", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...backdropState, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(paintEffects.length ? { effects: paintEffects } : {}), ...(animationTracks.group.length || animationTracks.paint.length ? { tracks: [...animationTracks.group, ...animationTracks.paint] } : {}), timing: { start: 0, duration }, payload: { contours: pathContours!, fillRule: fillRuleValue as "nonzero" | "evenodd" }, style: styleForPath });
        } else {
          // Keep all generated paint passes inside the element's stacking
           // scope. A border is a separate pass so its centered stroke can be
           // inset without changing the element's sibling order.
           const textGroupRequired = textPayload !== undefined && (backgroundValue !== undefined || backgroundImages.length > 0 || hasBorder || hasOutline);
           const clipPathId = elementClipPath();
           if (textPayload !== undefined && !textGroupRequired && !maskLayerRefs && !paintEffects.length && !backdropFilterEffects.length && !compositeNeedsGroup && clipPathId === undefined && motion === undefined && !animationTracks.group.length && !animationTracks.paint.length && render3d === undefined && backfaceVisibility === "visible") {
             layers.push({ id: groupId, type: "text", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...(textShadows.length ? { effects: textShadows } : {}), ...(textClipId ? { clipPath: textClipId } : {}), timing: { start: 0, duration }, payload: textPayload });
             emitOutline(false);
             return;
           }
           const needsPaintGroup = textGroupRequired || hasChildren || backgroundImages.length > 0 || hasSizedGradientBackground || maskLayerRefs !== undefined || hasBorder || hasOutline || paintEffects.length > 0 || backdropFilterEffects.length > 0 || compositeNeedsGroup || clipPathId !== undefined || motion !== undefined || animationTracks.group.length > 0 || animationTracks.paint.length > 0 || render3d !== undefined || backfaceVisibility !== "visible";
           // Element opacity belongs to the stacking group. Generated paint
           // passes are children of that group and must remain opaque, or a
           // non-default CSS opacity would be multiplied twice by runtime.
           const paintOpacity = needsPaintGroup ? 1 : opacity;
           if (needsPaintGroup) layers.push({ id: groupId, type: "group", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...backdropState, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(paintEffects.length ? { effects: paintEffects } : {}), ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(render3d ? { render3d } : {}), ...(animationTracks.group.length ? { tracks: animationTracks.group } : {}), timing: { start: 0, duration } });
          const paintLayerBaseOrder = layers.length;
          emitNodePaint({
            style, node, viewport, paints, paintBoxFor, backgroundImages, boxFor, cornerRadius,
            needsPaintGroup, paintOpacity, groupId, parentId, zIndex, localX, localY, transformFor,
            state, duration, paintAnimationTracks, paintLayerBaseOrder, layers, clipPaths, mediaAsset,
          });
          if (hasBorder) {
            emitNodeBorder({
              border, borderBox, cornerRadius, zIndex, paintLayerBaseOrder, paintsCount: paints.length,
              backgroundImagesCount: backgroundImages.length, groupId, parentId, needsPaintGroup,
              localX, localY, transformFor, paintOpacity, state, duration, borderAnimationTracks, layers,
            });
          }
             if (textPayload !== undefined) {
               // Text decorations belong to the element's stacking group, but
               // glyph effects must remain on the text surface. Keeping this
               // as a child preserves CSS paint order without applying the
               // element transform, opacity or filter twice.
               layers.push({
                 id: `${groupId}::text`,
                 type: "text",
                 parentLayerId: groupId,
                 order: Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) + 1500000 : layers.length + 1500000,
                 frame: { width: w, height: h },
                 transform: transformFor(0, 0, false),
                 opacity: 1,
                 ...state,
                 ...(textShadows.length ? { effects: textShadows } : {}),
                 ...(textClipId ? { clipPath: textClipId } : {}),
                 ...(animationTracks.paint.length ? { tracks: animationTracks.paint } : {}),
                 timing: { start: 0, duration },
                 payload: textPayload,
               });
             }
             // Outline is a paint-only pass. Emit it after descendants so it
             // remains on top of the element's content without affecting
             // layout geometry.
            emitOutline(true);
          }
       }
      const childX = x + geometry.padding[3] + geometry.borderEdges[3];
      const childY = y + geometry.padding[0] + geometry.borderEdges[0];
      const currentPosition = style.get("position") ?? "static";
      // CSS absolute descendants resolve against the nearest positioned
      // ancestor's padding box, while normal-flow children start in its
      // content box. Keeping these two coordinate spaces separate avoids
      // applying the parent's padding twice to an absolute child.
      const childContainingBlock = currentPosition === "relative" || currentPosition === "absolute" || style.get("display") === "flex" || style.get("display") === "grid"
        ? paddingBox(geometry.layoutBox, geometry.borderEdges)
        : positionedBlock;
      if (style.get("display") === "flex") {
        const placements = resolveFlexLayout({
          children: node.children,
          styles,
          containerStyle: style,
          containerBox: layoutBox,
          fontSize: font,
          viewport,
          measure: (child, childContainingWidth, childContainingHeight) => {
            const childStyle = styles.get(child) ?? style;
            const childFont = number(childStyle, "font-size", childContainingWidth, font, 16, viewport) || font;
            return resolveGeometry({ style: childStyle, parentX: 0, parentY: 0, containingWidth: childContainingWidth, containingHeight: childContainingHeight, fontSize: childFont, viewport });
          },
        });
        for (const placement of placements) {
          layoutEngine.setOverride(placement.node, placement);
          layout(placement.node, node, placement.x, placement.y, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style, childContainingBlock);
          layoutEngine.clearOverride(placement.node);
        }
        for (const child of node.children) {
          const childStyle = styles.get(child) ?? style;
          if ((childStyle.get("position") ?? "static") === "absolute") layout(child, node, childContainingBlock.x, childContainingBlock.y, childContainingBlock.width, childContainingBlock.height, style, childContainingBlock);
        }
      } else if (style.get("display") === "grid") {
        const placements = resolveGridLayout({
          children: node.children,
          styles,
          containerStyle: style,
          containerBox: layoutBox,
          fontSize: font,
          viewport,
          measure: (child, childContainingWidth, childContainingHeight) => {
            const childStyle = styles.get(child) ?? style;
            const childFont = number(childStyle, "font-size", childContainingWidth, font, 16, viewport) || font;
            return resolveGeometry({ style: childStyle, parentX: 0, parentY: 0, containingWidth: childContainingWidth, containingHeight: childContainingHeight, fontSize: childFont, viewport });
          },
        });
        for (const placement of placements) {
          layoutEngine.setOverride(placement.node, placement);
          layout(placement.node, node, placement.x, placement.y, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style, childContainingBlock);
          layoutEngine.clearOverride(placement.node);
        }
        for (const child of node.children) {
          const childStyle = styles.get(child) ?? style;
          if ((childStyle.get("position") ?? "static") === "absolute") layout(child, node, childContainingBlock.x, childContainingBlock.y, childContainingBlock.width, childContainingBlock.height, style, childContainingBlock);
        }
      } else if (node.tag === "svg" || node.tag === "g") {
        svgLayout(node.children, node, childX, childY, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style, childContainingBlock);
      } else {
        flowLayout(node.children, node, childX, childY, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style, childContainingBlock, { flowY: childY - firstChildMarginConsumed, previousBottomMargin: 0, hasFlowChild: false });
      }
      // Outline is a paint-only pass. Emit it after descendants so it remains
      // on top of the element's content without affecting layout geometry.
    }
    const rootContainingBlock: ContainingBlock = compositionRect(width, height);
    // CSS propagates a body background to the canvas when the document root is
    // transparent. `composition.background` is intentionally only a solid
    // clear color, so keep the body gradient as an explicit full-frame paint
    // layer instead of silently dropping it with the non-painting body node.
    // This preserves the existing V2 composition schema while making the
    // browser canvas and Runtime/Skia see the same root background pixels.
    if (body) {
      const rootBackground = bodyStyle.get("background")?.trim();
      const rootPaints = rootBackground && (/^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(rootBackground) || rootBackground.includes(","))
        ? parsePaintLayers(rootBackground, "background", bodyStyle.get("color") ?? "#000000", { width, height })
        : [];
      rootPaints
        .map((fill, index) => ({ fill, index }))
        .filter(({ fill }) => typeof fill !== "string" || fill !== "#00000000")
        .reverse()
        .forEach(({ fill, index }) => {
          layers.push({
            id: `html-root-background:${index}`,
            type: "shape",
            parentLayerId: null,
            order: layers.length,
            frame: { width, height },
            transform: { translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 } },
            opacity: 1,
            timing: { start: 0, duration },
            payload: { shape: "rectangle" },
            style: { fill },
          });
        });
    }
    if (body) flowLayout(body.children, body, 0, 0, width, height, bodyStyle, rootContainingBlock, { flowY: 0, previousBottomMargin: 0, hasFlowChild: false }); else flowLayout(root.children, null, 0, 0, width, height, new Map(), rootContainingBlock, { flowY: 0, previousBottomMargin: 0, hasFlowChild: false });
    // The global Web Crypto API (not node:crypto) so this keeps working in
    // both the Node compiler and any future browser-side compile path.
    const protocol = MotionProtocolV2Schema.parse({ format: "motion-protocol", formatVersion: 2, id: options.composition?.id ?? crypto.randomUUID(), composition: { width, height, fps, background: backgroundColor, colorSpace: composition.colorSpace, view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } } }, assets, layers, ...(clipPaths.length ? { clipPaths } : {}), ...(masks.length ? { masks } : {}), audio: { sampleRate: 48000, tracks: audioTracks } });
    return { status: "success", source, protocol, diagnostics: [] };
  } catch (error) { const diagnostic = error instanceof CompileError ? { severity: "error" as const, code: error.code, message: error.message, ...(error.source ? { source: error.source } : {}) } : { severity: "error" as const, code: "html-compiler-internal", message: error instanceof Error ? error.message : String(error) }; return { status: "error", source, protocol: null, diagnostics: [diagnostic] }; }
}

function validateComposition(value: unknown): HtmlCssSource["composition"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("html-composition-invalid", "Composition must be an object");
  }
  const composition = value as Record<string, unknown>;
  if (!Number.isInteger(composition.width) || Number(composition.width) <= 0) {
    fail("html-composition-invalid", "Composition width must be a positive integer");
  }
  if (!Number.isInteger(composition.height) || Number(composition.height) <= 0) {
    fail("html-composition-invalid", "Composition height must be a positive integer");
  }
  if (typeof composition.fps !== "number" || !Number.isFinite(composition.fps) || composition.fps <= 0) {
    fail("html-composition-invalid", "Composition fps must be a positive number");
  }
  if (typeof composition.background !== "string" || !composition.background.trim()) {
    fail("html-composition-invalid", "Composition background must be a non-empty color");
  }
  if (composition.colorSpace !== "srgb") {
    fail("html-composition-invalid", "Only srgb color space is currently supported");
  }
  if (composition.durationMs !== undefined && (typeof composition.durationMs !== "number" || !Number.isFinite(composition.durationMs) || composition.durationMs <= 0)) {
    fail("html-composition-invalid", "Composition durationMs must be a positive number");
  }
  return {
    width: Number(composition.width),
    height: Number(composition.height),
    fps: Number(composition.fps),
    background: String(composition.background),
    colorSpace: "srgb",
    ...(composition.durationMs === undefined ? {} : { durationMs: Number(composition.durationMs) }),
  };
}

function sameComposition(left: HtmlCssSource["composition"], right: HtmlCssSource["composition"]): boolean {
  return left.width === right.width && left.height === right.height && left.fps === right.fps && left.background === right.background && left.colorSpace === right.colorSpace;
}
