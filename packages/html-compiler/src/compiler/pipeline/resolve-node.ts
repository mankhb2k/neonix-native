/**
 * `layout()` (compile.ts) resolves every CSS domain for one DOM node before
 * assembling its Protocol V2 layer(s). Each per-property parser already
 * lives in its own file (paint.ts, filter.ts, composite.ts, ...); this file
 * holds the node-level glue that gathers several of those together for one
 * concern that doesn't belong to any single one of them.
 */
import type { MotionProtocolV2, V2SvgDefinitionNode } from "@motionvideo/motion-protocol/v2";
import type { Node, Style } from "../model";
import type { HtmlCompilerFontAsset } from "../../source";
import type { ResolvedGeometry } from "../geometry";
import type { AssetRegistry } from "../lowering/assets";
import { parseColor, parsePaintLayers, parseShadows, type Paint, type ShadowEffect } from "../paint";
import { parseFilter, type HtmlFilterEffect } from "../filter";
import { parseComposite, type HtmlComposite } from "../composite";
import { parsePathStyle, parseSvgPathData } from "../path";
import { isSvgNode, isTextFlowNode, collectTextContentWithStyles, normalizeTextContentWithStyles } from "../lowering/dispatcher";
import { svgPrimitivePath } from "../lowering/svg";
import {
  parseLineHeight,
  parseTextAlign,
  parseTextDecoration,
  parseTextDirection,
  parseTextOverflow,
  parseTextRendering,
  parseTextSpacing,
  parseWhiteSpace,
  parseWritingMode,
  resolveFontAssets,
  wrapForWhiteSpace,
  type HtmlCompilerTextAlign,
  type HtmlCompilerTextDirection,
} from "../css/typography";
import { number } from "../css/values";
import { fail } from "../errors";
import type { CornerRadius, Outline } from "../paint";
import type { CompileClipPaths, CompileLayers } from "../compile-context";
import type { NodeTransformState } from "../transform";
import { rectangleContour, roundedRectContour, roundedRectContourAtInset, type HtmlPathContour } from "./shape-contours";
import { parseClipPath, type ClipReferenceBoxes } from "../clip";

type HtmlTextLayer = Extract<MotionProtocolV2["layers"][number], { type: "text" }>;

function textAnchorForTextAlign(value: HtmlCompilerTextAlign, direction: HtmlCompilerTextDirection): "start" | "middle" | "end" {
  if (value === "center") return "middle";
  if (value === "right" || (value === "end" && direction === "ltr") || (value === "start" && direction === "rtl")) return "end";
  return "start";
}

function textGradientPaint(style: Style, width: number, height: number, currentColor: string): Paint | undefined {
  if (style.get("background-clip")?.trim().toLowerCase() !== "text") return undefined;
  const background = style.get("background")?.trim();
  if (!background || /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(background) === false) return undefined;
  const paints = parsePaintLayers(background, "background", currentColor, { width, height });
  const paint = paints.length === 1 ? paints[0] : undefined;
  return paint && typeof paint !== "string" && ["linear-gradient", "radial-gradient", "conic-gradient"].includes(paint.type)
    ? paint
    : undefined;
}

function textPaintFallbackColor(paint: Paint, fallback: string): string {
  if (typeof paint === "string") return paint;
  return "stops" in paint ? paint.stops?.[0]?.color ?? fallback : fallback;
}

export type NodePaintEffects = {
  textShadows: ShadowEffect[];
  paintEffects: Array<ShadowEffect | HtmlFilterEffect>;
  compositeState: Partial<{ composite: HtmlComposite }>;
  compositeNeedsGroup: boolean;
};

/** Resolves box-shadow/text-shadow/filter/mix-blend-mode+isolation together - every one of these is a "paint decoration" that can force an element into its own paint group. */
export function resolveNodePaintEffects(style: Style, containingWidth: number, fontSize: number, viewport: { width: number; height: number }, currentColor: string): NodePaintEffects {
  const textShadows = parseShadows(style, "text-shadow", containingWidth, fontSize, viewport, currentColor);
  const boxShadows = parseShadows(style, "box-shadow", containingWidth, fontSize, viewport, currentColor);
  const filterEffects = parseFilter(style.get("filter"), containingWidth, fontSize, viewport, currentColor);
  const paintEffects = [...boxShadows, ...filterEffects];
  const composite = parseComposite(style);
  const compositeState = composite ? { composite } : {};
  const compositeNeedsGroup = composite !== undefined;
  return { textShadows, paintEffects, compositeState, compositeNeedsGroup };
}

export type NodeSvgPathResolution = {
  isPath: boolean;
  pathContours: ReturnType<typeof parseSvgPathData> | undefined;
  pathStyle: ReturnType<typeof parsePathStyle> | undefined;
  fillRuleValue: string;
};

/** An SVG shape primitive (rect/circle/polygon/...) is already normalized to a raw `d`-equivalent path by lowering/svg.ts; a literal `<path>` reads its own `d` attribute directly. Both resolve through the same path-style/fill-rule contract. */
export function resolveNodeSvgPath(node: Node, style: Style, parentStyle: Style): NodeSvgPathResolution {
  const isPath = isSvgNode(node) && !["svg", "g"].includes(node.tag);
  const pathData = node.tag === "path" ? node.attributes.get("d") ?? "" : svgPrimitivePath(node) ?? "";
  const pathContours = isPath ? parseSvgPathData(pathData) : undefined;
  const pathStyle = isPath ? parsePathStyle(node, style, style.get("color") ?? parentStyle.get("color") ?? "#000000") : undefined;
  const fillRuleValue = (style.get("fill-rule") ?? node.attributes.get("fill-rule") ?? "nonzero").toLowerCase();
  if (isPath && !["nonzero", "evenodd"].includes(fillRuleValue)) fail("css-path-fill-rule-invalid", `Unsupported fill-rule: ${fillRuleValue}`);
  return { isPath, pathContours, pathStyle, fillRuleValue };
}

export type NodeTextPayloadInput = {
  node: Node;
  style: Style;
  parentStyle: Style;
  styles: Map<Node, Style>;
  hasChildren: boolean;
  groupId: string;
  width: number;
  height: number;
  containingWidth: number;
  viewport: { width: number; height: number };
  parentFontSize: number;
  geometry: ResolvedGeometry;
  fontAssets: readonly HtmlCompilerFontAsset[];
  assetRegistry: AssetRegistry;
  /** The same clip-path registry closures `layout()` uses for every other
   * clip need (overflow, backdrop-filter, clip-path) - overflow:hidden text
   * registers its own content-box clip through it. */
  registerClipPath: (additional?: V2SvgDefinitionNode[], legacyPrefix?: string) => string | undefined;
  elementClipPath: () => string | undefined;
};

export type NodeTextPayloadResolution = {
  textPayload: HtmlTextLayer["payload"] | undefined;
  textClipId: string | undefined;
  /** A `background-clip: text` gradient, read before background/paint
   * resolution decides whether the element still needs its own background
   * paint (a text gradient consumes `background`, it doesn't also paint it). */
  authoredTextGradient: Paint | undefined;
};

/** Collects this node's text content (respecting inline style runs and hard breaks) and, if there is any, resolves it into a complete Protocol V2 text payload - fonts, color/gradient fill per run, decoration, spacing, alignment and wrap/overflow layout. */
export function resolveNodeTextPayload(input: NodeTextPayloadInput): NodeTextPayloadResolution {
  const { node, style, parentStyle, styles, hasChildren, groupId, width: w, height: h, containingWidth, viewport, parentFontSize: parentFont, geometry, fontAssets, assetRegistry, registerClipPath, elementClipPath } = input;
  const rawNodeText = node.text.normalize("NFC");
  const collectedText = isTextFlowNode(node)
    ? normalizeTextContentWithStyles(collectTextContentWithStyles(node, styles), hasChildren)
    : { text: hasChildren ? rawNodeText.trim() : rawNodeText, hardBreaks: [], styleRuns: [{ start: 0, end: hasChildren ? rawNodeText.trim().length : rawNodeText.length, style }] };
  const { text, hardBreaks, styleRuns } = collectedText;
  let textPayload: HtmlTextLayer["payload"] | undefined;
  let textClipId: string | undefined;
  const authoredTextGradient = textGradientPaint(
    style,
    w,
    h,
    style.get("color") ?? parentStyle.get("color") ?? "#000000",
  );
  if (text) {
    const font = resolveFontAssets(style, fontAssets);
    assetRegistry.registerFonts(font.assets);
    const textColor = parseColor(style.get("color") ?? parentStyle.get("color") ?? "#000000", "color");
    const textAlign = parseTextAlign(style.get("text-align"));
    const renderTextAlign = textAlign === "match-parent" ? parseTextAlign(parentStyle.get("text-align")) : textAlign;
    const direction = parseTextDirection(style.get("direction"));
    const writingMode = parseWritingMode(style.get("writing-mode"));
    const whiteSpace = parseWhiteSpace(style.get("white-space"));
    const wrap = wrapForWhiteSpace(whiteSpace);
    const textOverflow = parseTextOverflow(style.get("text-overflow"));
    const hasWidth = style.get("width") !== undefined && style.get("width")!.trim().toLowerCase() !== "auto";
    const hasHeight = style.get("height") !== undefined && style.get("height")!.trim().toLowerCase() !== "auto";
    const sizing = textOverflow === "ellipsis" || (hasWidth && hasHeight)
      ? "fixed" as const
      : hasWidth
        ? "fixed-width-auto-height" as const
        : "auto-width-height" as const;
    const textRendering = parseTextRendering(style.get("text-rendering"));
    if (textOverflow === "ellipsis" && style.get("overflow") !== "hidden") fail("css-text-overflow-requires-clipping", "text-overflow: ellipsis requires overflow: hidden");
    if (textOverflow === "ellipsis" && (whiteSpace !== "nowrap" || writingMode !== "horizontal-tb")) fail("css-text-overflow-ellipsis-unsupported", "text-overflow: ellipsis requires white-space: nowrap and horizontal-tb writing-mode");
    textClipId = style.get("overflow") === "hidden"
      ? registerClipPath([{ type: "rect", x: geometry.borderEdges[3] + geometry.padding[3], y: geometry.borderEdges[0] + geometry.padding[0], width: geometry.contentWidth, height: geometry.contentHeight }], "html-text-clip")
      : elementClipPath();
    const baseFontSize = number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont;
    const effectiveStyleRuns = styleRuns.length ? styleRuns : [{ start: 0, end: text.length, style }];
    const spans = effectiveStyleRuns.map((run, runIndex) => {
      const runStyle = run.style;
      const runFontSize = number(runStyle, "font-size", containingWidth, baseFontSize, 16, viewport) || baseFontSize;
      const runFont = resolveFontAssets(runStyle, fontAssets);
      assetRegistry.registerFonts(runFont.assets);
      const runColorValue = parseColor(runStyle.get("color") ?? textColor, "color");
      const runGradient = textGradientPaint(
        runStyle,
        w,
        h,
        runStyle.get("color") ?? style.get("color") ?? parentStyle.get("color") ?? "#000000",
      );
      const runColor = runGradient ? textPaintFallbackColor(runGradient, runColorValue) : runColorValue;
      const runDecoration = parseTextDecoration(runStyle.get("text-decoration"), runColor, containingWidth, runFontSize, viewport);
      const runLetterSpacing = parseTextSpacing(runStyle.get("letter-spacing"), "letter-spacing", containingWidth, runFontSize, viewport);
      const runWordSpacing = parseTextSpacing(runStyle.get("word-spacing"), "word-spacing", containingWidth, runFontSize, viewport);
      return {
        id: `${groupId}::span-${runIndex}`,
        sourceRange: { start: run.start, end: run.end },
        resolvedFontAssetIds: runFont.assets.map((asset) => asset.id),
        font: { families: runFont.families, size: runFontSize, weight: runFont.weight, style: runFont.style, stretch: runFont.stretch },
        letterSpacing: runLetterSpacing,
        wordSpacing: runWordSpacing,
        ...(runDecoration ? { textDecoration: runDecoration } : {}),
        fill: runGradient ?? runColor,
      };
    });
    textPayload = {
      source: { text, language: node.attributes.get("lang") ?? "und", direction, writingMode, whiteSpace: "default", textRendering },
      layout: { sizing, lineHeight: parseLineHeight(style, number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont, viewport), contentWidth: geometry.contentWidth, contentHeight: geometry.contentHeight, contentOffsetX: geometry.borderEdges[3] + geometry.padding[3], contentOffsetY: geometry.borderEdges[0] + geometry.padding[0], textAlign, whiteSpace, wrap, textOverflow, ...(hardBreaks.length ? { hardBreaks } : {}), ...(textOverflow === "ellipsis" ? { maxLines: 1 } : {}) },
      chunks: [{
        id: `${groupId}::chunk`,
        sourceRange: { start: 0, end: text.length },
        textAnchor: textAnchorForTextAlign(renderTextAlign, direction),
        spans,
      }],
    };
  }
  return { textPayload, textClipId, authoredTextGradient };
}

function outlineContours(width: number, height: number, radius: CornerRadius | undefined, outline: Outline, id: string): HtmlPathContour[] {
  // Lower a solid outline to a filled ring instead of a centered stroke.
  // This makes the CSS contract explicit: outline-offset is the gap from the
  // border edge to the outline's inner edge, while outline-width is the ring
  // thickness. It also avoids backend-dependent half-stroke rasterization.
  const outerInset = -(outline.offset + outline.width);
  const innerInset = -outline.offset;
  if (radius === undefined) return [
    rectangleContour(width, height, outerInset, `${id}:outer`),
    rectangleContour(width, height, innerInset, `${id}:inner`),
  ];
  const base = typeof radius === "number"
    ? { topLeft: { rx: radius, ry: radius }, topRight: { rx: radius, ry: radius }, bottomRight: { rx: radius, ry: radius }, bottomLeft: { rx: radius, ry: radius } }
    : radius;
  const contourFor = (inset: number, delta: number, suffix: string) => {
    const adjusted = Object.fromEntries(Object.entries(base).map(([corner, value]) => [corner, { rx: Math.max(0, value.rx + delta), ry: Math.max(0, value.ry + delta) }])) as Exclude<CornerRadius, number>;
    return roundedRectContourAtInset(width, height, inset, adjusted, `${id}:${suffix}`);
  };
  return [
    contourFor(outerInset, outline.offset + outline.width, "outer"),
    contourFor(innerInset, outline.offset, "inner"),
  ];
}

export type NodeOutlineInput = {
  outline: Outline;
  cornerRadius: CornerRadius | undefined;
  width: number;
  height: number;
  groupId: string;
  parentId: string | null;
  localX: number;
  localY: number;
  zIndex: number | undefined;
  opacity: number;
  /** `{ enabled: false }` when visibility:hidden, else `{}` - spread directly onto every emitted layer. */
  state: Partial<{ enabled: boolean }>;
  duration: number;
  transformFor: NodeTransformState["transformFor"];
  /** The shared, mutable layer list this node's layout() call is building - outline layers are pushed directly onto it, same as every other layer this element emits. */
  layers: CompileLayers;
};

export type NodeOutlineResolution = {
  hasOutline: boolean;
  /** Pushes this element's outline layer(s) onto `layers` - a no-op if there is no outline. `insideGroup` mirrors every other per-layer emit in layout(): true when this element already has its own paint-group wrapper (so the outline is parented to that group, at its local origin), false when it must carry the element's own world transform directly. */
  emitOutline: (insideGroup: boolean) => void;
};

/** Resolves whether this element has a visible CSS outline and returns the closure that emits it - a filled ring (four polygons for a square corner, a rounded evenodd contour pair otherwise) rather than a centered stroke, so rasterization never depends on the backend's stroke-join behavior. */
export function resolveNodeOutline(input: NodeOutlineInput): NodeOutlineResolution {
  const { outline, cornerRadius, width: w, height: h, groupId, parentId, localX, localY, zIndex, opacity, state, duration, transformFor, layers } = input;
  const hasOutline = outline.style !== "none" && outline.width > 0;
  const emitOutline = (insideGroup: boolean) => {
    if (!hasOutline) return;
    const parentLayerId = insideGroup ? groupId : parentId;
    const transform = insideGroup ? transformFor(0, 0, false) : transformFor(localX, localY, true);
    // Border orders reserve a later paint band (including z-index offsets),
    // so outline must explicitly be emitted above that band.
    const outlineOrder = Number.isFinite(zIndex)
      ? Math.max(0, 100000 + (zIndex as number)) + 2000000
      : layers.length + 2000000;
    if (cornerRadius === undefined || cornerRadius === 0) {
      // A rectangular outline is a filled paint band. Four side polygons
      // avoid the inner contour antialias seam that Skia can expose when a
      // negative-offset even-odd ring overlaps a border.
      const outer = -(outline.offset + outline.width);
      const inner = -outline.offset;
      const right = w - outer;
      const bottom = h - outer;
      const innerRight = w - inner;
      const innerBottom = h - inner;
      const sides: Array<{ name: string; points: Array<{ x: number; y: number }> }> = [
        { name: "top", points: [{ x: outer, y: outer }, { x: right, y: outer }, { x: innerRight, y: inner }, { x: inner, y: inner }] },
        { name: "right", points: [{ x: right, y: outer }, { x: right, y: bottom }, { x: innerRight, y: innerBottom }, { x: innerRight, y: inner }] },
        { name: "bottom", points: [{ x: outer, y: bottom }, { x: right, y: bottom }, { x: innerRight, y: innerBottom }, { x: inner, y: innerBottom }] },
        { name: "left", points: [{ x: outer, y: outer }, { x: inner, y: inner }, { x: inner, y: innerBottom }, { x: outer, y: bottom }] },
      ];
      sides.forEach((side, index) => layers.push({
        id: `${groupId}::outline${index === 0 ? "" : `:${side.name}`}`,
        type: "shape",
        parentLayerId,
        order: outlineOrder + index,
        frame: { width: w, height: h },
        transform,
        opacity: insideGroup ? 1 : opacity,
        ...state,
        timing: { start: 0, duration },
        payload: { shape: "polygon", points: side.points },
        style: { fill: outline.color },
      } as Extract<MotionProtocolV2["layers"][number], { type: "shape" }>));
      return;
    }
    layers.push({
      id: `${groupId}::outline`,
      type: "path",
      parentLayerId,
      order: outlineOrder,
      frame: { width: w, height: h },
      transform,
      opacity: insideGroup ? 1 : opacity,
      ...state,
      timing: { start: 0, duration },
      payload: { contours: outlineContours(w, h, cornerRadius, outline, `${groupId}::outline-contour`), fillRule: "evenodd" },
      style: { fill: outline.color },
    } as Extract<MotionProtocolV2["layers"][number], { type: "path" }>);
  };
  return { hasOutline, emitOutline };
}

export type NodeClipPathInput = {
  style: Style;
  width: number;
  height: number;
  viewport: { width: number; height: number };
  geometry: ResolvedGeometry;
  cornerRadius: CornerRadius | undefined;
  hasChildren: boolean;
  hasBackdropFilter: boolean;
  /** The shared, mutable clip-path definition list this whole document is building - every `<clipPath>` this node's overflow/clip-path/backdrop-filter needs registers itself onto it. */
  clipPaths: CompileClipPaths;
};

export type NodeClipPathResolution = {
  /** Registers one `<clipPath>` combining this element's own clip-path/overflow/backdrop-filter children plus any `additional` shapes the caller supplies (e.g. a text content-box clip for overflow:hidden text), returning its id - or undefined if there is nothing to clip. Each call registers a NEW clipPath (a second call with different `additional` shapes is not the same clip as `elementClipPath()`'s cached one). */
  registerClipPath: (additional?: V2SvgDefinitionNode[], legacyPrefix?: string) => string | undefined;
  /** The element's own clip (no additional shapes), memoized - every layer this element emits shares the same clipPath id. */
  elementClipPath: () => string | undefined;
};

/** Resolves the one clip-path registry this element's layer(s) share: CSS clip-path, overflow:hidden's rounded border-box clip (for its children), and backdrop-filter's rounded border-box clip (for a leaf element's own isolation group) all combine into the same registered `<clipPath>` definition. */
export function resolveNodeClipPath(input: NodeClipPathInput): NodeClipPathResolution {
  const { style, width: w, height: h, viewport, geometry, cornerRadius, hasChildren, hasBackdropFilter, clipPaths } = input;
  const roundedBorderBoxClip = (): V2SvgDefinitionNode => {
    if (cornerRadius === undefined) return { type: "rect", x: 0, y: 0, width: w, height: h };
    if (typeof cornerRadius === "number") return { type: "rect", x: 0, y: 0, width: w, height: h, rx: cornerRadius, ry: cornerRadius };
    return { type: "path", contours: [roundedRectContour(w, h, cornerRadius)], fillRule: "nonzero" };
  };
  const clipBoxes: ClipReferenceBoxes = {
    borderBox: { x: 0, y: 0, width: w, height: h, viewport },
    paddingBox: { x: geometry.borderEdges[3], y: geometry.borderEdges[0], width: Math.max(0, w - geometry.borderEdges[1] - geometry.borderEdges[3]), height: Math.max(0, h - geometry.borderEdges[0] - geometry.borderEdges[2]), viewport },
    contentBox: { x: geometry.borderEdges[3] + geometry.padding[3], y: geometry.borderEdges[0] + geometry.padding[0], width: geometry.contentWidth, height: geometry.contentHeight, viewport },
  };
  const clipShape = parseClipPath(style.get("clip-path"), clipBoxes);
  // CSS overflow clipping uses the element's rounded border box. This also
  // keeps the emitted semantic clip precise enough for children of a
  // rounded `overflow: hidden` container.
  const overflowClipChildren: V2SvgDefinitionNode[] = hasChildren && style.get("overflow") === "hidden" ? [roundedBorderBoxClip()] : [];
  // Backdrop-filter itself is clipped by the rounded border box. For a leaf
  // element, attach that clip to the isolation group so Skia can install it
  // before capturing the backdrop. Do not apply it to an arbitrary
  // descendant subtree: border-radius alone does not make `overflow` clip
  // child content in CSS.
  const backdropClipChildren: V2SvgDefinitionNode[] = !hasChildren && hasBackdropFilter && cornerRadius !== undefined ? [roundedBorderBoxClip()] : [];
  const baseClipChildren: V2SvgDefinitionNode[] = [
    ...(clipShape ? [clipShape] : []),
    ...overflowClipChildren,
    ...backdropClipChildren,
  ];
  const registerClipPath = (additional: V2SvgDefinitionNode[] = [], legacyPrefix?: string): string | undefined => {
    const children = [...baseClipChildren, ...additional];
    if (children.length === 0) return undefined;
    const id = legacyPrefix && clipShape === undefined ? `${legacyPrefix}-${clipPaths.length}` : `html-clip-path-${clipPaths.length}`;
    clipPaths.push({ id, clipPathUnits: "userSpaceOnUse", children });
    return id;
  };
  let elementClipPathId: string | undefined;
  const elementClipPath = (): string | undefined => {
    if (elementClipPathId !== undefined) return elementClipPathId;
    const legacyPrefix = overflowClipChildren.length > 0
      ? "html-overflow-clip"
      : backdropClipChildren.length > 0
        ? "html-backdrop-clip"
        : undefined;
    elementClipPathId = registerClipPath([], clipShape ? undefined : legacyPrefix);
    return elementClipPathId;
  };
  return { registerClipPath, elementClipPath };
}
