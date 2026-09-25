import { MotionProtocolV2Schema, type MotionProtocolV2, type V2Paint, type V2SvgDefinitionNode } from "@motionvideo/motion-protocol/v2";
import {
  DEFAULT_HTML_CSS_COMPOSITION,
  type HtmlCssProject,
  type HtmlCompilerOptions,
  type HtmlCompilerResult,
  type NeonixHtmlProjectConfig,
  type HtmlCssSource,
  type HtmlDocumentInput,
} from "../../source";
import { CompileError, CompileIssues, fail } from "../errors";
import { neonixManifest, withoutNeonixManifest } from "../html/manifest";
import { parseHtml } from "../html/parser";
import { parseAnimationStyles, parseRules } from "../css/parser";
import { computed } from "../css/cascade";
import { edges, number, resolveVar } from "../css/values";
import { parseBorderEdges, parseColor, parseCornerRadii, parseOutline, parsePaintLayers, type CornerRadius, type Paint, type Outline } from "../paint";
import { resolveNodeTransformState } from "../transform";
import { resolveGeometry, resizeResolvedGeometry } from "../geometry";
import { collapseVerticalMargins } from "../layout";
import { assertLayoutBox, compositionRect, paddingBox, type LayoutRect } from "../layout-ir";
import { createLayoutEngine, layoutFlowChildren, type FlowState } from "../layout/engine";
import { resolveFlexLayout } from "../flex";
import { resolveGridLayout } from "../grid";
import { mediaSource, parseImageFit, parseImageRendering, parseObjectPosition } from "../lowering/media";
import { parseBackgroundBox, parseBackgroundImages, parseBackgroundPosition, parseBackgroundRepeat, parseBackgroundSize, parseMaskImages, type BackgroundBox, type BackgroundImage } from "../background";
import { parseFilter } from "../filter";
import { resolveNodeClipPath, resolveNodeOutline, resolveNodePaintEffects, resolveNodeSvgPath, resolveNodeTextPayload } from "./resolve-node";
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
import { borderBand, borderRegion, circlePolygon, clipConvexPolygon, fitBorderDashRuns, shadeBorderColor } from "./border/geometry";
import { buildRoundedDashRuns, buildRoundedDotRuns } from "./border/rounded-dash";
import { rectangleContour, roundedRectContour } from "./shape-contours";

/**
 * Preserve CSS background-image's two coordinate systems for the common
 * repeat/repeat case: the element is the owner rect, while the gradient is
 * authored inside one background tile. Chromium rasterizes that tile first
 * and repeats the generated image over the owner. Protocol V2 already has a
 * pattern paint that represents the same contract.
 *
 * This is intentionally limited to zero-position, two-axis linear gradients
 * with a repeated background image. Other repeat modes still use the bounded lowering below until
 * their per-axis phase semantics are represented explicitly in the pattern
 * backend.
 */
function repeatLinearGradientPattern(
  fill: Paint,
  tileWidth: number,
  tileHeight: number,
  repeat: ReturnType<typeof parseBackgroundRepeat>,
  position: ReturnType<typeof parseBackgroundPosition>,
): V2Paint | undefined {
  if (
    typeof fill === "string" ||
    fill.type !== "linear-gradient" ||
    repeat !== "repeat" ||
    position.x !== 0 ||
    position.y !== 0
  ) return undefined;
  if (!Number.isFinite(tileWidth) || !Number.isFinite(tileHeight) || tileWidth <= 0 || tileHeight <= 0) return undefined;

  const angle = ((fill.angle ?? 0) * Math.PI) / 180;
  const tileLength = Math.abs(Math.cos(angle)) * tileWidth + Math.abs(Math.sin(angle)) * tileHeight;
  if (!Number.isFinite(tileLength) || tileLength <= 0) return undefined;

  const halfLength = tileLength / 2;
  const startX = tileWidth / 2 - Math.cos(angle) * halfLength;
  const startY = tileHeight / 2 - Math.sin(angle) * halfLength;
  const endX = tileWidth / 2 + Math.cos(angle) * halfLength;
  const endY = tileHeight / 2 + Math.sin(angle) * halfLength;

  const tileGradient = {
    ...fill,
    gradientUnits: "userSpaceOnUse" as const,
    x1: startX,
    y1: startY,
    x2: endX,
    y2: endY,
  } as Extract<V2Paint, { type: "linear-gradient" }>;

  return {
    type: "pattern",
    x: 0,
    y: 0,
    width: tileWidth,
    height: tileHeight,
    patternUnits: "userSpaceOnUse",
    patternContentUnits: "userSpaceOnUse",
    content: [{ type: "rect", x: 0, y: 0, width: tileWidth, height: tileHeight, fill: tileGradient }],
  };
}

/**
 * Re-resolve radial circle geometry in the local background-image tile.
 *
 * CSS resolves a background gradient inside its background-size image before
 * that image is repeated over the owner box. The parser initially receives
 * the owner box, so a `circle` farthest-corner radius can be normalized against
 * the wrong aspect ratio. A materialized tile must use its own dimensions.
 */
function resolveGradientForTile(fill: Paint, tileWidth: number, tileHeight: number): Paint {
  if (
    typeof fill === "string" ||
    fill.type !== "radial-gradient" ||
    fill.radius === undefined ||
    !Number.isFinite(tileWidth) ||
    !Number.isFinite(tileHeight) ||
    tileWidth <= 0 ||
    tileHeight <= 0
  ) return fill;

  const cx = fill.cx ?? 0.5;
  const cy = fill.cy ?? 0.5;
  const radius = Math.hypot(
    Math.max(cx * tileWidth, (1 - cx) * tileWidth),
    Math.max(cy * tileHeight, (1 - cy) * tileHeight),
  ) / Math.min(tileWidth, tileHeight);

  return Number.isFinite(radius) ? { ...fill, radius } : fill;
}

function estimateTextIntrinsicHeight(text: string, style: Style, fontSize: number, containingWidth: number, viewport: { width: number; height: number }): number {
  const lineHeight = parseLineHeight(style, fontSize, viewport);
  const whiteSpace = parseWhiteSpace(style.get("white-space"));
  const explicitLines = text.split(/\r?\n/);
  if (whiteSpace === "nowrap" || whiteSpace === "pre") return Math.max(1, explicitLines.length) * lineHeight;

  const padding = edges(style, "padding", containingWidth, fontSize, 16, viewport);
  const border = parseBorderEdges(style, containingWidth, fontSize, viewport);
  const horizontalDecorations = padding[1] + padding[3] + border.right.width + border.left.width;
  const boxSizing = (style.get("box-sizing") ?? "content-box").trim().toLowerCase();
  const declaredWidth = number(style, "width", containingWidth, fontSize, 16, viewport);
  const contentWidth = Number.isFinite(declaredWidth)
    ? Math.max(1, boxSizing === "border-box" ? declaredWidth - horizontalDecorations : declaredWidth)
    : Math.max(1, containingWidth - horizontalDecorations);
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
    const walkStyles = (node: Node, parent: Style) => { const style = computed(node, rules, parent); const scopedVars = new Map<string, string>(); for (const [property, value] of style) if (property.startsWith("--")) scopedVars.set(property, value); for (const [property, value] of [...style]) { const resolved = resolveVar(value, scopedVars, new Set()); style.set(property, resolved); if (property.startsWith("--")) scopedVars.set(property, resolved); } const currentColor = style.get("color") ?? parent.get("color") ?? "#000000"; for (const [property, value] of style) { if (property === "background" || property === "background-color") parsePaintLayers(value, property, currentColor); else if (property === "mask-image") parseMaskImages(style, currentColor, { width, height }); else if (property === "color" || property === "border-color" || property === "fill" || property === "stroke") { if (!(property === "fill" || property === "stroke") || value.toLowerCase() !== "none") parseColor(value, property, currentColor); } } styles.set(node, style); node.children.forEach((child) => walkStyles(child, style)); }; if (body) walkStyles(body, rootVars); else root.children.forEach((child) => walkStyles(child, rootVars));
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
    const backgroundBox = (geometry: ReturnType<typeof resolveGeometry>, box: BackgroundBox): LayoutRect => {
      const border = geometry.borderEdges;
      const padding = geometry.padding;
      if (box === "border-box") return { x: 0, y: 0, width: geometry.width, height: geometry.height };
      if (box === "padding-box") return { x: border[3], y: border[0], width: Math.max(1, geometry.width - border[1] - border[3]), height: Math.max(1, geometry.height - border[0] - border[2]) };
      return { x: border[3] + padding[3], y: border[0] + padding[0], width: Math.max(1, geometry.contentWidth), height: Math.max(1, geometry.contentHeight) };
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
        contentHeight = estimateTextIntrinsicHeight(text, childStyle, childFont, containingWidth, viewport);
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
        intrinsicContentHeight = estimateTextIntrinsicHeight(geometryText, style, font, containingWidth, viewport);
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
        const opacityValue = style.get("opacity"); const opacity = opacityValue === undefined ? 1 : Number(opacityValue); if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) fail("css-opacity-invalid", `opacity must be between 0 and 1: ${opacityValue}`);
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
          const backgroundShorthand = style.get("background")?.trim(); const backgroundValue = authoredTextGradient ? undefined : backgroundShorthand && (/^\w+-gradient\(/i.test(backgroundShorthand) || backgroundShorthand.includes(",")) ? backgroundShorthand : style.get("background-color") ?? backgroundShorthand; const paints = backgroundValue === undefined ? (hasChildren && ["svg", "g"].includes(node.tag) ? [] : ["#00000000" as Paint]) : parsePaintLayers(backgroundValue, "background", style.get("color") ?? parentStyle.get("color") ?? "#000000", { width: w, height: h }); const border = parseBorderEdges(style, containingWidth, font, viewport);
          const backgroundImages = parseBackgroundImages(style, style.get("color") ?? parentStyle.get("color") ?? "#000000", { width: w, height: h });
          const boxFor = (box: BackgroundBox): LayoutRect => backgroundBox(geometry, box);
          const paintBoxFor = (index: number): LayoutRect => boxFor(parseBackgroundBox(style, "background-clip", index));
          const borderBox = boxFor("border-box");
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
           const hasBorder = Object.values(border).some((side) => side.width > 0 && side.style !== "none");
           const textGroupRequired = textPayload !== undefined && (backgroundValue !== undefined || backgroundImages.length > 0 || hasBorder || hasOutline);
           const clipPathId = elementClipPath();
           if (textPayload !== undefined && !textGroupRequired && !maskLayerRefs && !paintEffects.length && !backdropFilterEffects.length && !compositeNeedsGroup && clipPathId === undefined && motion === undefined && !animationTracks.group.length && !animationTracks.paint.length && render3d === undefined && backfaceVisibility === "visible") {
             layers.push({ id: groupId, type: "text", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...(textShadows.length ? { effects: textShadows } : {}), ...(textClipId ? { clipPath: textClipId } : {}), timing: { start: 0, duration }, payload: textPayload });
             emitOutline(false);
             return;
           }
           const hasSizedGradientBackground = style.get("background-size") !== undefined && style.get("background-size")?.trim().toLowerCase() !== "auto" && paints.some((fill) => typeof fill !== "string" && (fill.type === "linear-gradient" || fill.type === "radial-gradient" || fill.type === "conic-gradient"));
           const needsPaintGroup = textGroupRequired || hasChildren || backgroundImages.length > 0 || hasSizedGradientBackground || maskLayerRefs !== undefined || hasBorder || hasOutline || paintEffects.length > 0 || backdropFilterEffects.length > 0 || compositeNeedsGroup || clipPathId !== undefined || motion !== undefined || animationTracks.group.length > 0 || animationTracks.paint.length > 0 || render3d !== undefined || backfaceVisibility !== "visible";
           // Element opacity belongs to the stacking group. Generated paint
           // passes are children of that group and must remain opaque, or a
           // non-default CSS opacity would be multiplied twice by runtime.
           const paintOpacity = needsPaintGroup ? 1 : opacity;
           if (needsPaintGroup) layers.push({ id: groupId, type: "group", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...backdropState, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(paintEffects.length ? { effects: paintEffects } : {}), ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(render3d ? { render3d } : {}), ...(animationTracks.group.length ? { tracks: animationTracks.group } : {}), timing: { start: 0, duration } });
          const paintLayerBaseOrder = layers.length;
           paints.forEach((fill, index) => {
          const paintId = paints.length === 1 ? (needsPaintGroup ? `${groupId}::paint` : groupId) : `${groupId}::paint:${index}`;
          const paintBox = paintBoxFor(index);
          // A CSS gradient used as a background image has two independent
          // coordinate systems: the gradient itself and the background image
          // tile. The old lowering kept only the gradient and painted it over
          // the complete element, silently dropping background-size and
          // background-repeat for shorthand backgrounds. Lower explicit
          // sized gradient tiles through the same bounded path as URL
          // backgrounds so the V2 contract remains deterministic for Skia.
          const isGradientPaint = typeof fill !== "string" && (
            fill.type === "linear-gradient" || fill.type === "radial-gradient" || fill.type === "conic-gradient"
          );
          const backgroundSize = isGradientPaint
            ? parseBackgroundSize(style, index, paintBox.width, paintBox.height, viewport)
            : { type: "auto" as const };
          const backgroundRepeat = isGradientPaint ? parseBackgroundRepeat(style, index) : "repeat" as const;
          const shouldTileGradient = isGradientPaint && backgroundSize.type === "length";
          // CSS background layers are painted back-to-front: the last
          // listed layer is underneath the first listed layer. Protocol V2
          // draws larger order values later, so reverse only this paint-layer
          // offset while keeping the source array and generated ids stable.
          const paintOrderOffset = paints.length > 1 ? paints.length - index - 1 : 0;
          const order = Number.isFinite(zIndex)
            ? Math.max(0, 100000 + (zIndex as number)) + paintOrderOffset
            : paintLayerBaseOrder + paintOrderOffset;
          const paintTransform = transformFor(needsPaintGroup ? paintBox.x : localX + paintBox.x, needsPaintGroup ? paintBox.y : localY + paintBox.y, !needsPaintGroup);
          if (shouldTileGradient && backgroundSize.type === "length") {
            const drawWidth = Math.max(1, backgroundSize.width);
            const drawHeight = Math.max(1, backgroundSize.height);
            const position = parseBackgroundPosition(style, index);
            const xRepeats = backgroundRepeat === "repeat" || backgroundRepeat === "repeat-x";
            const yRepeats = backgroundRepeat === "repeat" || backgroundRepeat === "repeat-y";
            const startX = paintBox.x + (paintBox.width - drawWidth) * position.x;
            const startY = paintBox.y + (paintBox.height - drawHeight) * position.y;
            const rectRepeatFill = repeatLinearGradientPattern(fill, drawWidth, drawHeight, backgroundRepeat, position);
            if (rectRepeatFill) {
              layers.push({
                id: paintId,
                type: "shape",
                parentLayerId: needsPaintGroup ? groupId : parentId,
                order,
                frame: { width: paintBox.width, height: paintBox.height },
                transform: paintTransform,
                opacity: paintOpacity,
                ...state,
                ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}),
                timing: { start: 0, duration },
                payload: { shape: "rectangle" },
                style: { fill: rectRepeatFill },
              });
              return;
            }
            // Emit only tiles that intersect the background clip box. The
            // previous +/-1 overscan was useful for image sampling but creates
            // unnecessary layers and clip paths for deterministic CSS paints.
            const xStart = xRepeats ? Math.floor((paintBox.x - startX) / drawWidth) : 0;
            const xEnd = xRepeats ? Math.ceil((paintBox.x + paintBox.width - startX) / drawWidth) - 1 : 0;
            const yStart = yRepeats ? Math.floor((paintBox.y - startY) / drawHeight) : 0;
            const yEnd = yRepeats ? Math.ceil((paintBox.y + paintBox.height - startY) / drawHeight) - 1 : 0;
            const tileCount = Math.max(1, xEnd - xStart + 1) * Math.max(1, yEnd - yStart + 1);
            // Each bounded tile currently owns a clipPath in Protocol V2;
            // keep the generated document within the V2 clipPaths limit.
            if (tileCount > 256) fail("css-background-repeat-too-many-tiles", "background-repeat would generate more than 256 deterministic gradient tiles");
            let tileIndex = 0;
            for (let xTile = xStart; xTile <= xEnd; xTile += 1) for (let yTile = yStart; yTile <= yEnd; yTile += 1) {
              const tileX = startX + (xRepeats ? xTile * drawWidth : 0);
              const tileY = startY + (yRepeats ? yTile * drawHeight : 0);
              const clipId = `html-background-clip-${clipPaths.length}`;
              clipPaths.push({ id: clipId, clipPathUnits: "userSpaceOnUse", children: [{ type: "rect", x: paintBox.x - tileX, y: paintBox.y - tileY, width: paintBox.width, height: paintBox.height, ...(typeof cornerRadius === "number" ? { rx: cornerRadius, ry: cornerRadius } : {}) }] });
              layers.push({
                id: `${paintId}::tile:${tileIndex++}`,
                type: "shape",
                parentLayerId: needsPaintGroup ? groupId : parentId,
                order: (Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : paintLayerBaseOrder) + (paints.length - index - 1) * 10000 + tileIndex,
                frame: { width: drawWidth, height: drawHeight },
                transform: transformFor(needsPaintGroup ? tileX : localX + tileX, needsPaintGroup ? tileY : localY + tileY, false),
                opacity: paintOpacity,
                ...state,
                ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}),
                clipPath: clipId,
                timing: { start: 0, duration },
                payload: { shape: "rectangle" },
                 style: { fill: resolveGradientForTile(fill, drawWidth, drawHeight) },
               });
            }
            return;
          }
          if (typeof cornerRadius === "object") {
            // A rounded CSS background is one painted element. Do not split
            // it into overlapping rectangle/ellipse atoms: each atom would
            // source-over the same semi-transparent fill and make opacity
            // depend on the number of generated pieces. A single contour
            // preserves the browser's one-element compositing boundary.
            layers.push({
              id: paintId,
              type: "path",
              parentLayerId: needsPaintGroup ? groupId : parentId,
              order,
              frame: { width: paintBox.width, height: paintBox.height },
              transform: paintTransform,
              opacity: paintOpacity,
              ...state,
              ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}),
              timing: { start: 0, duration },
              payload: { contours: [roundedRectContour(paintBox.width, paintBox.height, cornerRadius)], fillRule: "nonzero" },
              style: { fill },
            });
          }
          else layers.push({ id: paintId, type: "shape", parentLayerId: needsPaintGroup ? groupId : parentId, order, frame: { width: paintBox.width, height: paintBox.height }, transform: paintTransform, opacity: paintOpacity, ...state, ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}), timing: { start: 0, duration }, payload: { shape: "rectangle", ...(cornerRadius === undefined ? {} : { cornerRadius }) }, style: { fill } });
           });
           if (backgroundImages.length > 0) {
             const alignFor = (position: ReturnType<typeof parseBackgroundPosition>) => `${position.x === 0 ? "xMin" : position.x === 1 ? "xMax" : "xMid"}${position.y === 0 ? "YMin" : position.y === 1 ? "YMax" : "YMid"}` as "xMinYMin" | "xMidYMin" | "xMaxYMin" | "xMinYMid" | "xMidYMid" | "xMaxYMid" | "xMinYMax" | "xMidYMax" | "xMaxYMax";
             const emitBackgroundLayer = (image: BackgroundImage, imageIndex: number, tileIndex: number, drawX: number, drawY: number, drawWidth: number, drawHeight: number, fit: "none" | "contain" | "cover" | "fill", align: ReturnType<typeof alignFor>, clipBox: LayoutRect) => {
               const clipId = `html-background-clip-${clipPaths.length}`;
               clipPaths.push({ id: clipId, clipPathUnits: "userSpaceOnUse", children: [{ type: "rect", x: clipBox.x - drawX, y: clipBox.y - drawY, width: clipBox.width, height: clipBox.height, ...(typeof cornerRadius === "number" ? { rx: cornerRadius, ry: cornerRadius } : {}) }] });
               const orderBase = Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : paintLayerBaseOrder + paints.length;
               const order = orderBase + (backgroundImages.length - imageIndex) * 10000 + tileIndex;
               const id = `${groupId}::background:${imageIndex}${tileIndex === 0 ? "" : `:${tileIndex}`}`;
               const parentLayerId = groupId;
               if (image.type === "paint" || image.type === "color") {
                 layers.push({ id, type: "shape", parentLayerId, order, frame: { width: drawWidth, height: drawHeight }, transform: transformFor(drawX, drawY, false), opacity: paintOpacity * (image.opacity ?? 1), ...state, clipPath: clipId, timing: { start: 0, duration }, payload: { shape: "rectangle" }, style: { fill: image.type === "paint" ? image.paint : image.color } });
                 return;
               }
               const preserveAspectRatio = fit === "fill" ? { align: "none" as const } : { align, ...(fit === "cover" ? { meetOrSlice: "slice" as const } : fit === "contain" ? { meetOrSlice: "meet" as const } : {}) };
              layers.push({ id, type: "image", parentLayerId, order, frame: { width: drawWidth, height: drawHeight }, transform: transformFor(drawX, drawY, false), opacity: paintOpacity * (image.opacity ?? 1), ...state, clipPath: clipId, timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "image", image.uri, `background-${imageIndex}-${tileIndex}-asset`), x: 0, y: 0, width: drawWidth, height: drawHeight, fit, preserveAspectRatio } });
             };
             backgroundImages.forEach((image, imageIndex) => {
               const origin = boxFor(parseBackgroundBox(style, "background-origin", imageIndex));
               const clipBox = boxFor(parseBackgroundBox(style, "background-clip", imageIndex));
               const position = parseBackgroundPosition(style, imageIndex);
               const size = parseBackgroundSize(style, imageIndex, origin.width, origin.height, viewport);
               const repeat = parseBackgroundRepeat(style, imageIndex);
               if (repeat !== "no-repeat" && size.type !== "length") fail("css-background-repeat-needs-size", "Repeating a background image requires an explicit two-dimensional background-size in the deterministic compiler");
               if (size.type === "length") {
                 const drawWidth = Math.max(1, size.width); const drawHeight = Math.max(1, size.height);
                 const startX = origin.x + (origin.width - drawWidth) * position.x; const startY = origin.y + (origin.height - drawHeight) * position.y;
                 const xRepeats = repeat === "repeat" || repeat === "repeat-x"; const yRepeats = repeat === "repeat" || repeat === "repeat-y";
                 const xStart = xRepeats ? Math.floor((clipBox.x - startX) / drawWidth) - 1 : 0; const xEnd = xRepeats ? Math.ceil((clipBox.x + clipBox.width - startX) / drawWidth) + 1 : 0;
                 const yStart = yRepeats ? Math.floor((clipBox.y - startY) / drawHeight) - 1 : 0; const yEnd = yRepeats ? Math.ceil((clipBox.y + clipBox.height - startY) / drawHeight) + 1 : 0;
                 const tileCount = Math.max(1, xEnd - xStart + 1) * Math.max(1, yEnd - yStart + 1);
                 if (tileCount > 4096) fail("css-background-repeat-too-many-tiles", "background-repeat would generate more than 4096 deterministic image tiles");
                 let tileIndex = 0;
                 for (let xTile = xStart; xTile <= xEnd; xTile += 1) for (let yTile = yStart; yTile <= yEnd; yTile += 1) {
                   emitBackgroundLayer(image, imageIndex, tileIndex++, startX + (xRepeats ? xTile * drawWidth : 0), startY + (yRepeats ? yTile * drawHeight : 0), drawWidth, drawHeight, "fill", "xMinYMin", clipBox);
                 }
                 return;
               }
               const fit = size.type === "cover" ? "cover" : size.type === "contain" ? "contain" : "none";
               const align = alignFor(position);
               emitBackgroundLayer(image, imageIndex, 0, origin.x, origin.y, origin.width, origin.height, fit, align, clipBox);
             });
           }
          if (hasBorder) {
             const uniformBorder = Object.values(border).every((side) => side.style === "solid" && side.width === Object.values(border)[0]!.width && side.color === Object.values(border)[0]!.color);
             const inset = uniformBorder ? Object.values(border)[0]!.width / 2 : 0;
             const borderWidth = Math.max(1, borderBox.width - (uniformBorder ? Object.values(border)[0]!.width : 0));
             const borderHeight = Math.max(1, borderBox.height - (uniformBorder ? Object.values(border)[0]!.width : 0));
             const borderOrder = Number.isFinite(zIndex)
               ? Math.max(0, 100000 + (zIndex as number)) + 1000000
               : paintLayerBaseOrder + paints.length + backgroundImages.length * 100000 + 1000;
             const borderId = `${groupId}::border`;
             // A rounded dashed/dotted border cannot be lowered to the
             // discrete-polygon-per-run trick used for the sharp-corner case
             // (fitBorderDashRuns): once the perimeter has arcs, the border
             // is one continuous curved path, so it must carry a real
             // strokeDash the same way SVG stroke-dasharray does. Reuse the
             // exact geometry the solid-uniform-radius branches already use
             // below (shape+cornerRadius for a simple numeric radius,
             // roundedRectContour for the elliptical/per-corner object
             // form) so the border footprint matches pixel-for-pixel; only
             // the paint (stroke -> dashed stroke) differs.
             const uniformDashedBorder = (border.top.style === "dashed" || border.top.style === "dotted")
               && Object.values(border).every((side) => side.style === border.top.style && side.width === border.top.width && side.color === border.top.color);
             if (uniformDashedBorder && typeof cornerRadius === "object") {
               const runs = border.top.style === "dotted"
                 ? buildRoundedDotRuns(borderBox.width, borderBox.height, cornerRadius, border.top.width)
                 : buildRoundedDashRuns(borderBox.width, borderBox.height, cornerRadius, border.top.width);
               layers.push({
                 id: borderId,
                 type: "path",
                 parentLayerId: needsPaintGroup ? groupId : parentId,
                 order: borderOrder,
                 frame: { width: borderBox.width, height: borderBox.height },
                 transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
                 opacity: paintOpacity,
                 ...state,
                 ...(borderAnimationTracks.length ? { tracks: borderAnimationTracks } : {}),
                 timing: { start: 0, duration },
                 payload: { contours: runs },
                 style: { fill: "none", stroke: border.top.color, strokeWidth: border.top.width, strokeCap: border.top.style === "dotted" ? "round" : "butt" },
               } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
             }
             else if (uniformDashedBorder && typeof cornerRadius === "number" && cornerRadius > 0) {
               // Literal pre-baked geometry (see rounded-dash.ts) instead of a
               // runtime strokeDash cycled around a closed rounded-rect path:
               // CanvasKit's SkPathEffect::MakeDash reproducibly corrupts one
               // dash at a line-to-cubic verb transition on a closed bezier
               // path (isolated via the debug/svg-rounded-rect-dash-isolation
               // fixture, independent of html-compiler's own math), so the
               // fix is to never hand CanvasKit a closed path + PathEffect
               // for this case at all.
               // Matches Chrome's own ContouredBorderGeometry::PixelSnapped
               // ContouredBorderWithOutsets exactly: a plain radius-width/2
               // subtraction with no positive floor (FloatRoundedRect::Radii
               // ::Outset), stroked with the default miter join (cc::PaintFlags
               // ::kDefault_Join). When cornerRadius <= strokeInset this
               // collapses to a sharp, square corner in the REAL browser too --
               // not a bug, confirmed by reading Blink's source (see
               // D:\NextJS\chromium-reference) and pixel-comparing against a
               // fresh Chrome capture. Chromium even tracks this as a known
               // rough edge for tight corners (box_border_painter.cc, crbug.com
               // /41089993), so matching it here (not "fixing" it) is what
               // keeps CanvasKit at 1:1 parity with the browser.
               const strokeInset = border.top.width / 2;
               const strokeWidth = Math.max(1, borderBox.width - border.top.width);
               const strokeHeight = Math.max(1, borderBox.height - border.top.width);
               const strokeRadius = Math.max(0, cornerRadius - strokeInset);
               const strokeRadii = {
                 topLeft: { rx: strokeRadius, ry: strokeRadius },
                 topRight: { rx: strokeRadius, ry: strokeRadius },
                 bottomRight: { rx: strokeRadius, ry: strokeRadius },
                 bottomLeft: { rx: strokeRadius, ry: strokeRadius },
               };
               const runs = border.top.style === "dotted"
                 ? buildRoundedDotRuns(strokeWidth, strokeHeight, strokeRadii, border.top.width)
                 : buildRoundedDashRuns(strokeWidth, strokeHeight, strokeRadii, border.top.width);
               layers.push({
                 id: borderId,
                 type: "path",
                 parentLayerId: needsPaintGroup ? groupId : parentId,
                 order: borderOrder,
                 frame: { width: strokeWidth, height: strokeHeight },
                 transform: transformFor(
                   needsPaintGroup ? strokeInset : localX + strokeInset,
                   needsPaintGroup ? strokeInset : localY + strokeInset,
                   !needsPaintGroup,
                 ),
                 opacity: paintOpacity,
                 ...state,
                 ...(borderAnimationTracks.length ? { tracks: borderAnimationTracks } : {}),
                 timing: { start: 0, duration },
                 payload: { contours: runs },
                 style: { fill: "none", stroke: border.top.color, strokeWidth: border.top.width, strokeCap: border.top.style === "dotted" ? "round" : "butt" },
               } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
             }
             else if (uniformBorder && typeof cornerRadius === "object") layers.push({
               id: borderId,
               type: "path",
               parentLayerId: needsPaintGroup ? groupId : parentId,
               order: borderOrder,
               frame: { width: borderBox.width, height: borderBox.height },
               transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
               opacity: paintOpacity,
               ...state,
               ...(borderAnimationTracks.length ? { tracks: borderAnimationTracks } : {}),
               timing: { start: 0, duration },
               payload: { contours: [roundedRectContour(borderBox.width, borderBox.height, cornerRadius)] },
               style: { fill: "none", stroke: Object.values(border)[0]!.color, strokeWidth: Object.values(border)[0]!.width },
             } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
             else if (uniformBorder && borderAnimationTracks.length > 0) layers.push({
               id: borderId,
               type: "path",
               parentLayerId: needsPaintGroup ? groupId : parentId,
               order: borderOrder,
               frame: { width: borderBox.width, height: borderBox.height },
               transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
               opacity: paintOpacity,
               ...state,
               tracks: borderAnimationTracks,
               timing: { start: 0, duration },
               payload: { contours: [rectangleContour(borderBox.width, borderBox.height, Object.values(border)[0]!.width / 2, `${borderId}:animated-contour`)] },
               style: { fill: "none", stroke: Object.values(border)[0]!.color, strokeWidth: Object.values(border)[0]!.width },
             } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
             else if (uniformBorder) layers.push({
               id: borderId,
               type: "shape",
               parentLayerId: needsPaintGroup ? groupId : parentId,
               order: borderOrder,
               frame: { width: borderWidth, height: borderHeight },
               transform: transformFor(needsPaintGroup ? inset : localX + inset, needsPaintGroup ? inset : localY + inset, !needsPaintGroup),
               opacity: paintOpacity,
               ...state,
               ...(borderAnimationTracks.length ? { tracks: borderAnimationTracks } : {}),
               timing: { start: 0, duration },
               payload: { shape: "rectangle", ...(typeof cornerRadius === "number" ? { cornerRadius: Math.max(0, cornerRadius - inset) } : {}) },
               style: { fill: "#00000000", stroke: Object.values(border)[0]!.color, strokeWidth: Object.values(border)[0]!.width },
             });
             else if (
               Object.values(border).every((side) =>
                 side.style === "double" &&
                 side.width === Object.values(border)[0]!.width &&
                 side.color === Object.values(border)[0]!.color,
               ) &&
               cornerRadius === undefined
             ) {
               const borderWidth = Object.values(border)[0]!.width;
               const strokeWidth = borderWidth / 3;
               const outerInset = strokeWidth / 2;
               const innerInset = borderWidth - outerInset;
               layers.push({
                 id: borderId,
                 type: "path",
                 parentLayerId: needsPaintGroup ? groupId : parentId,
                 order: borderOrder,
                 frame: { width: borderBox.width, height: borderBox.height },
                 transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
                 opacity: paintOpacity,
                 ...state,
                 timing: { start: 0, duration },
                 payload: {
                   contours: [
                     rectangleContour(borderBox.width, borderBox.height, outerInset, `${borderId}:outer`),
                     rectangleContour(borderBox.width, borderBox.height, innerInset, `${borderId}:inner`),
                   ],
                 },
                 style: {
                   fill: "none",
                   stroke: Object.values(border)[0]!.color,
                   strokeWidth,
                   strokeJoin: "miter",
                   strokeCap: "butt",
                 },
               } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
             }
             else {
               const emitBorderSide = (side: "top" | "right" | "bottom" | "left", index: number) => {
                 const config = border[side]; if (config.width <= 0 || config.style === "none") return;
                 if (config.style === "groove" || config.style === "ridge" || config.style === "inset" || config.style === "outset") {
                   const region = borderRegion(side, borderBox.width, borderBox.height, border.top.width, border.right.width, border.bottom.width, border.left.width);
                   const light = shadeBorderColor(config.color, 0.28);
                   const dark = shadeBorderColor(config.color, -0.28);
                   const topOrLeft = side === "top" || side === "left";
                   const pushBand = (bandIndex: number, from: number, to: number, color: string) => layers.push({
                     id: `${borderId}:${side}:band-${bandIndex}`,
                     type: "shape",
                     parentLayerId: needsPaintGroup ? groupId : parentId,
                     order: borderOrder + index * 100 + bandIndex,
                     frame: { width: borderBox.width, height: borderBox.height },
                     transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
                     opacity: paintOpacity,
                     ...state,
                     timing: { start: 0, duration },
                     payload: { shape: "polygon", points: borderBand(region, from, to) },
                     style: { fill: color },
                   } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
                   if (config.style === "inset" || config.style === "outset") {
                     const lightSide = config.style === "outset" ? topOrLeft : !topOrLeft;
                     pushBand(0, 0, 1, lightSide ? light : dark);
                   } else {
                     // Fixed lighting contract: groove is recessed and ridge is
                     // raised. Each side is split across its physical border
                     // width, so shading never changes layout geometry.
                     const outerDark = config.style === "groove" ? topOrLeft : !topOrLeft;
                     pushBand(0, 0, 0.5, outerDark ? dark : light);
                     pushBand(1, 0.5, 1, outerDark ? light : dark);
                   }
                   return;
                 }
                 // CSS does not paint unequal solid borders as four centered
                 // strokes. Each edge owns a trapezoid and adjacent edges
                 // meet on a diagonal at the corner. Using a butt-capped
                 // stroke here shortens the edge and leaves the wrong join.
                 // Lower solid edges to filled polygons so the protocol keeps
                 // the CSS border-box geometry without needing a new atom.
                 if (config.style === "solid") {
                   const width = borderBox.width;
                   const height = borderBox.height;
                   const top = border.top.width;
                   const right = border.right.width;
                   const bottom = border.bottom.width;
                   const left = border.left.width;
                   const points = side === "top"
                     ? [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width - right, y: top }, { x: left, y: top }]
                     : side === "right"
                       ? [{ x: width, y: 0 }, { x: width, y: height }, { x: width - right, y: height - bottom }, { x: width - right, y: top }]
                       : side === "bottom"
                         ? [{ x: 0, y: height }, { x: width, y: height }, { x: width - right, y: height - bottom }, { x: left, y: height - bottom }]
                         : [{ x: 0, y: 0 }, { x: left, y: top }, { x: left, y: height - bottom }, { x: 0, y: height }];
                   layers.push({
                     id: `${borderId}:${side}`,
                     type: "shape",
                     parentLayerId: needsPaintGroup ? groupId : parentId,
                     order: borderOrder + index * 10,
                     frame: { width, height },
                     transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup),
                     opacity: paintOpacity,
                     ...state,
                     timing: { start: 0, duration },
                     payload: { shape: "polygon", points },
                     style: { fill: config.color },
                   } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
                   return;
                 }
                 if ((cornerRadius === undefined || cornerRadius === 0) && (config.style === "dashed" || config.style === "dotted")) {
                   const horizontal = side === "top" || side === "bottom";
                   const edgeLength = horizontal ? borderBox.width : borderBox.height;
                   const runs = fitBorderDashRuns(edgeLength, config.width, config.style);
                   const region = borderRegion(side, borderBox.width, borderBox.height, border.top.width, border.right.width, border.bottom.width, border.left.width);
                   runs.forEach((run, runIndex) => {
                     const isDotted = config.style === "dotted";
                     if (!isDotted) {
                       const base = horizontal
                         ? [{ x: run.offset, y: side === "top" ? 0 : borderBox.height - config.width }, { x: run.offset + run.length, y: side === "top" ? 0 : borderBox.height - config.width }, { x: run.offset + run.length, y: side === "top" ? config.width : borderBox.height }, { x: run.offset, y: side === "top" ? config.width : borderBox.height }]
                         : [{ x: side === "left" ? 0 : borderBox.width - config.width, y: run.offset }, { x: side === "left" ? config.width : borderBox.width, y: run.offset }, { x: side === "left" ? config.width : borderBox.width, y: run.offset + run.length }, { x: side === "left" ? 0 : borderBox.width - config.width, y: run.offset + run.length }];
                       const points = clipConvexPolygon(base, region);
                       if (points.length < 3) return;
                       layers.push({ id: `${borderId}:${side}:${runIndex}`, type: "shape", parentLayerId: groupId, order: borderOrder + index * 10000 + runIndex, frame: { width: borderBox.width, height: borderBox.height }, transform: transformFor(0, 0, false), opacity: paintOpacity, ...state, timing: { start: 0, duration }, payload: { shape: "polygon", points }, style: { fill: config.color } } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
                       return;
                     }
                     const center = horizontal
                       ? { x: run.offset, y: side === "top" ? config.width / 2 : borderBox.height - config.width / 2 }
                       : { x: side === "left" ? config.width / 2 : borderBox.width - config.width / 2, y: run.offset };
                     const cornerRun = runIndex === 0 || runIndex === runs.length - 1;
                     if (cornerRun) {
                       const points = clipConvexPolygon(circlePolygon(center, config.width / 2), region);
                       if (points.length < 3) return;
                       layers.push({ id: `${borderId}:${side}:${runIndex}`, type: "shape", parentLayerId: groupId, order: borderOrder + index * 10000 + runIndex, frame: { width: borderBox.width, height: borderBox.height }, transform: transformFor(0, 0, false), opacity: paintOpacity, ...state, timing: { start: 0, duration }, payload: { shape: "polygon", points }, style: { fill: config.color } } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
                       return;
                     }
                     const offsetX = horizontal ? center.x - config.width / 2 : side === "left" ? 0 : borderBox.width - config.width;
                     const offsetY = horizontal ? (side === "top" ? 0 : borderBox.height - config.width) : center.y - config.width / 2;
                     layers.push({ id: `${borderId}:${side}:${runIndex}`, type: "shape", parentLayerId: groupId, order: borderOrder + index * 10000 + runIndex, frame: { width: config.width, height: config.width }, transform: transformFor(offsetX, offsetY, false), opacity: paintOpacity, ...state, timing: { start: 0, duration }, payload: { shape: "ellipse" }, style: { fill: config.color } } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>);
                   });
                   return;
                 }
                 const horizontal = side === "top" || side === "bottom";
                 const isDouble = config.style === "double";
                 const half = config.width / 2;
                 const start = horizontal
                   ? { x: isDouble ? 0 : half, y: side === "top" ? half : borderBox.height - half }
                   : { x: side === "left" ? (isDouble ? 0 : half) : borderBox.width - (isDouble ? 0 : half), y: isDouble ? 0 : half };
                 const end = horizontal
                   ? { x: isDouble ? borderBox.width : borderBox.width - half, y: start.y }
                   : { x: start.x, y: isDouble ? borderBox.height : borderBox.height - half };
                 // Chromium's CSS border painter uses a compact 2:1 dash/gap
                 // rhythm for `dashed`. For `dotted`, a round-capped near-zero
                 // dash produces one dot whose diameter is the border width;
                 // using a full-width dash here makes every dot twice as long.
                 const dash = config.style === "dashed"
                   ? { array: [config.width * 2, config.width], offset: 0 }
                   : config.style === "dotted"
                     ? { array: [config.width * 0.01, config.width * 2 - config.width * 0.01], offset: 0 }
                     : undefined;
                 const count = config.style === "double" ? 2 : 1;
                 for (let pass = 0; pass < count; pass += 1) {
                   const center = isDouble
                     ? (pass === 0 ? config.width / 6 : config.width * 5 / 6)
                     : half;
                   const movedStart = horizontal
                     ? { x: isDouble && pass === 1 ? config.width : start.x, y: side === "top" ? center : borderBox.height - center }
                     : { x: side === "left" ? center : borderBox.width - center, y: isDouble && pass === 1 ? config.width : start.y };
                   const movedEnd = horizontal
                     ? { x: isDouble && pass === 1 ? borderBox.width - config.width : end.x, y: movedStart.y }
                     : { x: movedStart.x, y: isDouble && pass === 1 ? borderBox.height - config.width : end.y };
                   layers.push({ id: `${borderId}:${side}:${pass}`, type: "path", parentLayerId: needsPaintGroup ? groupId : parentId, order: borderOrder + index * 10 + pass, frame: { width: borderBox.width, height: borderBox.height }, transform: transformFor(needsPaintGroup ? 0 : localX, needsPaintGroup ? 0 : localY, !needsPaintGroup), opacity: paintOpacity, ...state, timing: { start: 0, duration }, payload: { contours: [{ id: `${borderId}:${side}:${pass}-contour`, start: movedStart, segments: [{ kind: "line", to: movedEnd }], closed: false }] }, style: { fill: "none", stroke: config.color, strokeWidth: isDouble ? config.width / 3 : config.width, strokeCap: config.style === "dotted" ? "round" : "butt", ...(dash ? { strokeDash: dash } : {}) } } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
                 }
               };
               (["top", "right", "bottom", "left"] as const).forEach((side, index) => emitBorderSide(side, index));
              }
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
    const protocol = MotionProtocolV2Schema.parse({ format: "motion-protocol", formatVersion: 2, id: options.composition?.id ?? "gold-01-rectangle-solid-v1", composition: { width, height, fps, background: backgroundColor, colorSpace: composition.colorSpace, view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } } }, assets, layers, ...(clipPaths.length ? { clipPaths } : {}), ...(masks.length ? { masks } : {}), audio: { sampleRate: 48000, tracks: audioTracks } });
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
