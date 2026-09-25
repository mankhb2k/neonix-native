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
