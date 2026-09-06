import { MotionProtocolV2Schema, type MotionProtocolV2, type V2SvgDefinitionNode } from "@motionvideo/motion-protocol/v2";
import {
  DEFAULT_HTML_CSS_COMPOSITION,
  type HtmlCompilerOptions,
  type HtmlCompilerResult,
  type HtmlCssSource,
} from "./source";
export {
  DEFAULT_HTML_CSS_COMPOSITION,
  DEFAULT_NEONIX_HTML_DOCUMENT,
  createHtmlCssSource,
  createNewHtmlProject,
} from "./source";
export type {
  HtmlCompilerDiagnostic,
  HtmlCompilerOptions,
  HtmlCompilerFontAsset,
  HtmlCompilerResult,
  HtmlCssComposition,
  HtmlCssSource,
  HtmlCompilerSourceLocation,
  NeonixHtmlSourceV1,
} from "./source";
import { CompileError, fail } from "./compiler/errors";
import { parseHtml, neonixManifest, withoutNeonixManifest } from "./compiler/html";
import { parseAnimationStyles, parseRules } from "./compiler/css-parser";
import { computed } from "./compiler/cascade";
import { edges, number, resolveVar } from "./compiler/values";
import { parseBorderEdges, parseColor, parseCornerRadii, parseOutline, parsePaintLayers, parseShadows, type CornerRadius, type Paint, type Outline } from "./compiler/paint";
import { parsePathStyle, parseSvgPathData } from "./compiler/path";
import { parsePerspectiveContext, parseTransform } from "./compiler/transform";
import { resolveGeometry, resizeResolvedGeometry } from "./compiler/geometry";
import { collapseVerticalMargins } from "./compiler/layout";
import { assertLayoutBox, compositionRect, paddingBox, type LayoutRect } from "./compiler/layout-ir";
import { resolveFlexLayout } from "./compiler/flex";
import { resolveGridLayout } from "./compiler/grid";
import { mediaMimeType, mediaSource, parseImageFit, parseImageRendering, parseObjectPosition } from "./compiler/media";
import { parseBackgroundBox, parseBackgroundImages, parseBackgroundPosition, parseBackgroundRepeat, parseBackgroundSize, parseMaskImages, type BackgroundBox, type BackgroundImage } from "./compiler/background";
import { parseFilter } from "./compiler/filter";
import { parseComposite } from "./compiler/composite";
import { parseClipPath, type ClipReferenceBoxes } from "./compiler/clip";
import { parseLineHeight, parseTextAlign, parseTextDecoration, parseTextDirection, parseTextOverflow, parseTextRendering, parseTextSpacing, parseWhiteSpace, parseWritingMode, resolveFontAssets, type HtmlCompilerTextAlign, type HtmlCompilerTextDirection, wrapForWhiteSpace } from "./compiler/typography";
import { splitTopLevel } from "./compiler/utils";
import { animationTimelineDuration, lowerAnimationTracks } from "./compiler/animation";
import { motionPathLength, parseMotionPath } from "./compiler/motion-path";
import type { Node, Style } from "./compiler/model";

function textAnchorForTextAlign(value: HtmlCompilerTextAlign, direction: HtmlCompilerTextDirection): "start" | "middle" | "end" {
  if (value === "center") return "middle";
  if (value === "right" || (value === "end" && direction === "ltr") || (value === "start" && direction === "rtl")) return "end";
  return "start";
}

type HtmlPathContour = Extract<MotionProtocolV2["layers"][number], { type: "path" }>["payload"]["contours"][number];

type BorderDashRun = { offset: number; length: number };

type HtmlPoint = { x: number; y: number };

function polygonArea(points: readonly HtmlPoint[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function clipConvexPolygon(subject: readonly HtmlPoint[], clip: readonly HtmlPoint[]): HtmlPoint[] {
  const orientation = polygonArea(clip) >= 0 ? 1 : -1;
  const inside = (point: HtmlPoint, from: HtmlPoint, to: HtmlPoint) => orientation * ((to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)) >= -1e-7;
  const intersection = (start: HtmlPoint, end: HtmlPoint, from: HtmlPoint, to: HtmlPoint): HtmlPoint => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const ex = to.x - from.x;
    const ey = to.y - from.y;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) <= 1e-9) return end;
    const t = ((from.x - start.x) * ey - (from.y - start.y) * ex) / denominator;
    return { x: start.x + dx * t, y: start.y + dy * t };
  };
  let output = [...subject];
  for (let index = 0; index < clip.length && output.length > 0; index += 1) {
    const from = clip[index]!;
    const to = clip[(index + 1) % clip.length]!;
    const input = output;
    output = [];
    for (let pointIndex = 0; pointIndex < input.length; pointIndex += 1) {
      const start = input[pointIndex]!;
      const end = input[(pointIndex + 1) % input.length]!;
      const startInside = inside(start, from, to);
      const endInside = inside(end, from, to);
      if (startInside && endInside) output.push(end);
      else if (startInside && !endInside) output.push(intersection(start, end, from, to));
      else if (!startInside && endInside) output.push(intersection(start, end, from, to), end);
    }
  }
  return output;
}

function borderRegion(side: "top" | "right" | "bottom" | "left", width: number, height: number, top: number, right: number, bottom: number, left: number): HtmlPoint[] {
  if (side === "top") return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width - right, y: top }, { x: left, y: top }];
  if (side === "right") return [{ x: width, y: 0 }, { x: width, y: height }, { x: width - right, y: height - bottom }, { x: width - right, y: top }];
  if (side === "bottom") return [{ x: 0, y: height }, { x: width, y: height }, { x: width - right, y: height - bottom }, { x: left, y: height - bottom }];
  // Keep the same correspondence as the other sides: outer edge first,
  // inner edge second. This lets borderBand split by thickness rather than
  // accidentally splitting the left edge along its length.
  return [{ x: 0, y: 0 }, { x: 0, y: height }, { x: left, y: height - bottom }, { x: left, y: top }];
}

function shadeBorderColor(color: string, amount: number): string {
  const match = color.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!match) return color;
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(match[1]!.slice(offset, offset + 2), 16));
  const adjusted = rgb.map((channel) => Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount)));
  return `#${adjusted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}${match[2] ?? ""}`;
}

function borderBand(region: HtmlPoint[], from: number, to: number): HtmlPoint[] {
  const lerp = (outer: HtmlPoint, inner: HtmlPoint, amount: number): HtmlPoint => ({
    x: outer.x + (inner.x - outer.x) * amount,
    y: outer.y + (inner.y - outer.y) * amount,
  });
  const startAt = (amount: number) => lerp(region[0]!, region[3]!, amount);
  const endAt = (amount: number) => lerp(region[1]!, region[2]!, amount);
  return [startAt(from), endAt(from), endAt(to), startAt(to)];
}

function circlePolygon(center: HtmlPoint, radius: number, count = 32): HtmlPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

/**
 * CSS border dash lengths are not exposed as SVG dasharray values. Keep the
 * browser-compatible border rhythm deterministic by fitting a whole number
 * of runs to each physical border edge.
 */
function fitBorderDashRuns(length: number, width: number, style: "dashed" | "dotted"): BorderDashRun[] {
  const desiredPeriod = style === "dashed" ? width * 3 : width * 2;
  const count = Math.max(1, Math.round(length / Math.max(desiredPeriod, 1e-6)));
  const period = length / count;
  if (style === "dashed") return Array.from({ length: count }, (_, index) => ({ offset: index * period, length: period * 2 / 3 }));
  return Array.from({ length: count }, (_, index) => ({ offset: index * period + width / 2, length: width }));
}

function roundedRectContour(width: number, height: number, radius: Exclude<CornerRadius, number>): HtmlPathContour {
  const { topLeft, topRight, bottomRight, bottomLeft } = radius;
  const k = 0.5522847498;
  return {
    id: "rounded-rectangle-contour",
    start: { x: topLeft.rx, y: 0 },
    segments: [
      { kind: "line", to: { x: width - topRight.rx, y: 0 } },
      { kind: "cubic", control1: { x: width - topRight.rx + k * topRight.rx, y: 0 }, control2: { x: width, y: topRight.ry - k * topRight.ry }, to: { x: width, y: topRight.ry } },
      { kind: "line", to: { x: width, y: height - bottomRight.ry } },
      { kind: "cubic", control1: { x: width, y: height - bottomRight.ry + k * bottomRight.ry }, control2: { x: width - bottomRight.rx + k * bottomRight.rx, y: height }, to: { x: width - bottomRight.rx, y: height } },
      { kind: "line", to: { x: bottomLeft.rx, y: height } },
      { kind: "cubic", control1: { x: bottomLeft.rx - k * bottomLeft.rx, y: height }, control2: { x: 0, y: height - bottomLeft.ry + k * bottomLeft.ry }, to: { x: 0, y: height - bottomLeft.ry } },
      { kind: "line", to: { x: 0, y: topLeft.ry } },
      { kind: "cubic", control1: { x: 0, y: topLeft.ry - k * topLeft.ry }, control2: { x: topLeft.rx - k * topLeft.rx, y: 0 }, to: { x: topLeft.rx, y: 0 } },
    ],
    closed: true,
  };
}

function rectangleContour(width: number, height: number, inset: number, id: string): HtmlPathContour {
  return {
    id,
    start: { x: inset, y: inset },
    segments: [
      { kind: "line", to: { x: width - inset, y: inset } },
      { kind: "line", to: { x: width - inset, y: height - inset } },
      { kind: "line", to: { x: inset, y: height - inset } },
      { kind: "line", to: { x: inset, y: inset } },
    ],
    closed: true,
  };
}

function roundedRectContourAtInset(width: number, height: number, inset: number, radius: Exclude<CornerRadius, number>, id: string): HtmlPathContour {
  const { topLeft, topRight, bottomRight, bottomLeft } = radius;
  const k = 0.5522847498;
  const left = inset;
  const top = inset;
  const right = width - inset;
  const bottom = height - inset;
  return {
    id,
    start: { x: left + topLeft.rx, y: top },
    segments: [
      { kind: "line", to: { x: right - topRight.rx, y: top } },
      { kind: "cubic", control1: { x: right - topRight.rx + k * topRight.rx, y: top }, control2: { x: right, y: top + topRight.ry - k * topRight.ry }, to: { x: right, y: top + topRight.ry } },
      { kind: "line", to: { x: right, y: bottom - bottomRight.ry } },
      { kind: "cubic", control1: { x: right, y: bottom - bottomRight.ry + k * bottomRight.ry }, control2: { x: right - bottomRight.rx + k * bottomRight.rx, y: bottom }, to: { x: right - bottomRight.rx, y: bottom } },
      { kind: "line", to: { x: left + bottomLeft.rx, y: bottom } },
      { kind: "cubic", control1: { x: left + bottomLeft.rx - k * bottomLeft.rx, y: bottom }, control2: { x: left, y: bottom - bottomLeft.ry + k * bottomLeft.ry }, to: { x: left, y: bottom - bottomLeft.ry } },
      { kind: "line", to: { x: left, y: top + topLeft.ry } },
      { kind: "cubic", control1: { x: left, y: top + topLeft.ry - k * topLeft.ry }, control2: { x: left + topLeft.rx - k * topLeft.rx, y: top }, to: { x: left + topLeft.rx, y: top } },
    ],
    closed: true,
  };
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

function roundedRectFillPieces(width: number, height: number, radius: Exclude<CornerRadius, number>): Array<{ shape: "rectangle" | "ellipse"; x: number; y: number; width: number; height: number }> {
  const { topLeft, topRight, bottomRight, bottomLeft } = radius;
  const left = Math.max(topLeft.rx, bottomLeft.rx);
  const right = Math.max(topRight.rx, bottomRight.rx);
  const top = Math.max(topLeft.ry, topRight.ry);
  const bottom = Math.max(bottomLeft.ry, bottomRight.ry);
  return [
    { shape: "rectangle", x: topLeft.rx, y: 0, width: Math.max(1, width - topLeft.rx - topRight.rx), height: top },
    { shape: "rectangle", x: bottomLeft.rx, y: height - bottom, width: Math.max(1, width - bottomLeft.rx - bottomRight.rx), height: bottom },
    { shape: "rectangle", x: 0, y: topLeft.ry, width: left, height: Math.max(1, height - topLeft.ry - bottomLeft.ry) },
    { shape: "rectangle", x: width - right, y: topRight.ry, width: right, height: Math.max(1, height - topRight.ry - bottomRight.ry) },
    { shape: "rectangle", x: left, y: top, width: Math.max(1, width - left - right), height: Math.max(1, height - top - bottom) },
    { shape: "ellipse", x: 0, y: 0, width: topLeft.rx * 2, height: topLeft.ry * 2 },
    { shape: "ellipse", x: width - topRight.rx * 2, y: 0, width: topRight.rx * 2, height: topRight.ry * 2 },
    { shape: "ellipse", x: width - bottomRight.rx * 2, y: height - bottomRight.ry * 2, width: bottomRight.rx * 2, height: bottomRight.ry * 2 },
    { shape: "ellipse", x: 0, y: height - bottomLeft.ry * 2, width: bottomLeft.rx * 2, height: bottomLeft.ry * 2 },
  ];
}

function protocolFontAsset(asset: NonNullable<HtmlCompilerOptions["fontAssets"]>[number]): NonNullable<MotionProtocolV2["assets"]>[number] {
  return { id: asset.id, kind: "font", uri: asset.uri, weight: asset.weight, integrity: asset.integrity };
}

export function compileHtmlCss(source: HtmlCssSource, options: HtmlCompilerOptions = {}): HtmlCompilerResult {
  try {
    // The source envelope is the canonical composition contract. Keep the
    // legacy options as an escape hatch for duration/id, but never let them
    // make the browser and compiler disagree about the render viewport.
    const embeddedComposition = neonixManifest(source.html); const composition = { ...DEFAULT_HTML_CSS_COMPOSITION, ...(options.composition ?? {}), ...source.composition, ...(embeddedComposition ?? {}) }; if (composition.width !== 1920 || composition.height !== 1080 || composition.fps !== 30 || composition.background !== "#081018" || composition.colorSpace !== "srgb") fail("html-composition-invalid", "HTML/CSS sources must use the fixed 1920x1080 @ 30 composition with #081018 srgb"); const width = composition.width; const height = composition.height; const fps = composition.fps; const baseDuration = options.composition?.durationMs ?? 1000; const root = parseHtml(withoutNeonixManifest(source.html)); const parsedStylesheet = parseAnimationStyles(source.css); const rules = parseRules(parsedStylesheet.css); const keyframes = parsedStylesheet.keyframes; const viewport = { width, height }; const findNode = (node: Node, tag: string): Node | undefined => node.tag === tag ? node : node.children.map((child) => findNode(child, tag)).find(Boolean); const body = findNode(root, "body"); const rootVars = new Map<string, string>(); for (const rule of rules) if (rule.selectors.some((selector) => selector.trim() === ":root")) for (const declaration of rule.declarations) if (declaration.property.startsWith("--")) rootVars.set(declaration.property, declaration.value);
    const allNodes: Node[] = []; const visit = (node: Node) => { allNodes.push(node); node.children.forEach(visit); }; root.children.forEach(visit); const styles = new Map<Node, Style>();
    const walkStyles = (node: Node, parent: Style) => { const style = computed(node, rules, parent); const scopedVars = new Map<string, string>(); for (const [property, value] of style) if (property.startsWith("--")) scopedVars.set(property, value); for (const [property, value] of [...style]) { const resolved = resolveVar(value, scopedVars, new Set()); style.set(property, resolved); if (property.startsWith("--")) scopedVars.set(property, resolved); } const currentColor = style.get("color") ?? parent.get("color") ?? "#000000"; for (const [property, value] of style) { if (property === "background" || property === "background-color") parsePaintLayers(value, property, currentColor); else if (property === "mask-image") parseMaskImages(style, currentColor, { width, height }); else if (property === "color" || property === "border-color" || property === "fill" || property === "stroke") { if (!(property === "fill" || property === "stroke") || value.toLowerCase() !== "none") parseColor(value, property, currentColor); } } styles.set(node, style); node.children.forEach((child) => walkStyles(child, style)); }; if (body) walkStyles(body, rootVars); else root.children.forEach((child) => walkStyles(child, rootVars));
    if (body && !styles.has(body)) styles.set(body, computed(body, rules, new Map())); const duration = Math.max(baseDuration, ...[...styles.values()].map(animationTimelineDuration)); const bodyStyle = body ? styles.get(body)! : new Map<string, string>(); const backgroundColor = parseColor(composition.background, "composition background");
    type ContainingBlock = LayoutRect;
    type FlowState = { flowY: number; previousBottomMargin: number; hasFlowChild: boolean };
    const layers: MotionProtocolV2["layers"] = []; const assets: NonNullable<MotionProtocolV2["assets"]> = []; const clipPaths: NonNullable<MotionProtocolV2["clipPaths"]> = []; const masks: NonNullable<MotionProtocolV2["masks"]> = []; const origins = new Map<Node, { x: number; y: number }>(); const flowOrigins = new Map<Node, { x: number; y: number }>(); const sizes = new Map<Node, { width: number; height: number }>(); const layoutBoxes = new Map<Node, ReturnType<typeof resolveGeometry>["layoutBox"]>(); const layoutOverrides = new Map<Node, { x: number; y: number; width: number; height: number }>();
    const addAssets = (items: readonly NonNullable<MotionProtocolV2["assets"]>[number][]) => { for (const asset of items) if (!assets.some((candidate) => candidate.id === asset.id)) assets.push(asset); };
    const mediaAsset = (node: Node, kind: "image" | "video", uri: string, suffix = "asset") => {
      const id = `${node.atomicId}-${suffix}`;
      if (!assets.some((asset) => asset.id === id)) assets.push({ id, kind, uri, mimeType: mediaMimeType(uri, kind) });
      return id;
    };
    const maskSourceStyle = (style: Style): Style => new Map([
      ["background-position", style.get("mask-position") ?? "0% 0%"],
      ["background-size", style.get("mask-size") ?? "auto"],
      ["background-repeat", style.get("mask-repeat") ?? "repeat"],
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
      const sourceStyle = maskSourceStyle(style);
      images.forEach((image, imageIndex) => {
        const mode = parseMaskMode(style, imageIndex);
        // CSS has one composite operator between each pair of mask layers;
        // a stack of N images therefore consumes N - 1 values. The first
        // layer establishes the initial coverage and does not consume one.
        const composite = imageIndex === 0 ? "add" : parseMaskComposite(style, imageIndex - 1);
        const position = parseBackgroundPosition(sourceStyle, 0);
        const size = parseBackgroundSize(sourceStyle, 0, targetWidth, targetHeight);
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
        if (image.type === "paint") {
          const children: Array<{ type: "rect"; x: number; y: number; width: number; height: number; fill: Exclude<Paint, string> }> = [];
          let tileIndex = 0;
          for (let xTile = xStart; xTile <= xEnd; xTile += 1) for (let yTile = yStart; yTile <= yEnd; yTile += 1) {
            if (xRepeats || yRepeats || tileIndex === 0) children.push({ type: "rect", x: startX + (xRepeats ? xTile * drawWidth : 0), y: startY + (yRepeats ? yTile * drawHeight : 0), width: drawWidth, height: drawHeight, fill: image.paint });
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
              masks.push({ id, maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse", maskType: mode, image: { type: "image", assetId: mediaAsset(node, "image", image.uri, `mask-${imageIndex}-${tileIndex}-asset`), x: startX + (xRepeats ? xTile * drawWidth : 0), y: startY + (yRepeats ? yTile * drawHeight : 0), width: drawWidth, height: drawHeight, fit: "fill" } });
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
    const layoutFlowChildren = (children: Node[], parent: Node | null, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style, positionedBlock: ContainingBlock, state: FlowState) => {
      for (const child of children) {
        const childStyle = styles.get(child) ?? parentStyle;
        const childPosition = childStyle.get("position") ?? "static";
        if (childStyle.get("display") === "contents") {
          layoutFlowChildren(child.children, parent, parentX, parentY, containingWidth, containingHeight, childStyle, positionedBlock, state);
          continue;
        }
        const childMargin = edges(childStyle, "margin", containingWidth, number(parentStyle, "font-size", containingWidth, 16, 16, viewport) || 16, 16, viewport);
        if (childPosition === "absolute") {
          layout(child, parent, positionedBlock.x, positionedBlock.y, positionedBlock.width, positionedBlock.height, parentStyle, positionedBlock);
          continue;
        }
        const topMargin = childMargin[0];
        const collapsedMargin = state.hasFlowChild ? collapseVerticalMargins(state.previousBottomMargin, topMargin) : topMargin;
        const childParentY = state.flowY - topMargin + collapsedMargin;
        layout(child, parent, parentX, childParentY, containingWidth, containingHeight, parentStyle, positionedBlock);
        if (childStyle.get("display") === "none") continue;
        const childFlowOrigin = flowOrigins.get(child);
        const childSize = sizes.get(child);
        state.flowY = (childFlowOrigin?.y ?? childParentY) + (childSize?.height ?? 0);
        state.previousBottomMargin = childMargin[2];
        state.hasFlowChild = true;
      }
    };
    function layout(node: Node, parent: Node | null, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style, positionedBlock: ContainingBlock): void {
      const style = styles.get(node) ?? computed(node, rules, parentStyle); const parentFont = number(parentStyle, "font-size", containingWidth, 16, 16, viewport) || 16; const font = number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont; const baseGeometry = resolveGeometry({ style, parentX, parentY, containingWidth, containingHeight, fontSize: font, viewport }); const geometry = layoutOverrides.has(node) ? resizeResolvedGeometry(baseGeometry, layoutOverrides.get(node)!) : baseGeometry; const layoutBox = assertLayoutBox(geometry.layoutBox); const { x, y, width: w, height: h } = layoutBox; const { normalX, normalY } = geometry;
      layoutBoxes.set(node, layoutBox); origins.set(node, { x: layoutBox.x, y: layoutBox.y }); sizes.set(node, { width: layoutBox.width, height: layoutBox.height });
      flowOrigins.set(node, { x: normalX, y: normalY });
      if (style.get("display") === "none") return;
      if (style.get("display") === "contents") { node.children.forEach((child) => layout(child, parent, parentX, parentY, containingWidth, containingHeight, parentStyle, positionedBlock)); return; }
      if (node.tag !== "body" && style.get("display") !== "none" && w > 0 && h > 0) {
        const opacityValue = style.get("opacity"); const opacity = opacityValue === undefined ? 1 : Number(opacityValue); if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) fail("css-opacity-invalid", `opacity must be between 0 and 1: ${opacityValue}`);
        const parentId = parent?.tag === "body" ? null : (parent?.atomicId ?? null); const groupId = node.atomicId; const hasChildren = node.children.length > 0; const localX = parent?.children.length ? x - (origins.get(parent)?.x ?? parentX) : x; const localY = parent?.children.length ? y - (origins.get(parent)?.y ?? parentY) : y;
        const zIndexValue = style.get("z-index"); const zIndex = zIndexValue === undefined || zIndexValue === "auto" ? undefined : Number(zIndexValue); const layerOrder = Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : layers.length; const state = style.get("visibility") === "hidden" ? { enabled: false } : {};
        const clipBoxes: ClipReferenceBoxes = {
          borderBox: { x: 0, y: 0, width: w, height: h },
          paddingBox: { x: geometry.borderEdges[3], y: geometry.borderEdges[0], width: Math.max(0, w - geometry.borderEdges[1] - geometry.borderEdges[3]), height: Math.max(0, h - geometry.borderEdges[0] - geometry.borderEdges[2]) },
          contentBox: { x: geometry.borderEdges[3] + geometry.padding[3], y: geometry.borderEdges[0] + geometry.padding[0], width: geometry.contentWidth, height: geometry.contentHeight },
        };
        const clipShape = parseClipPath(style.get("clip-path"), clipBoxes);
        const overflowClipChildren: V2SvgDefinitionNode[] = hasChildren && style.get("overflow") === "hidden" ? [{ type: "rect", x: 0, y: 0, width: w, height: h }] : [];
        const baseClipChildren: V2SvgDefinitionNode[] = clipShape ? [clipShape, ...overflowClipChildren] : overflowClipChildren;
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
          elementClipPathId = registerClipPath([], clipShape ? undefined : "html-overflow-clip");
          return elementClipPathId;
        };
         const motion = parseMotionPath(style, w, h, font, viewport);
         const parsedTransform = parseTransform(style, w, h, font, viewport);
         const perspective = parsePerspectiveContext(style, w, h, font, viewport);
         const transformStyleValue = (style.get("transform-style") ?? "flat").trim().toLowerCase();
         if (transformStyleValue !== "flat" && transformStyleValue !== "preserve-3d") fail("css-transform-style-unsupported", `Unsupported transform-style value: ${transformStyleValue}`);
         // CSS grouping properties flatten a 3D rendering context even when
         // the authored transform-style says preserve-3d. In particular,
         // overflow:hidden establishes a local clipping/flattening boundary:
         // the element's own perspective still applies to its direct child,
         // but an ancestor perspective must not be chained through the
         // flattened subtree. Store the effective value in Protocol V2 so
         // Runtime/Skia can preserve the browser's paint order and clip scope.
         const overflowValue = (style.get("overflow") ?? "visible").trim().toLowerCase();
         const effectiveTransformStyleValue = overflowValue !== "visible" && overflowValue !== "clip"
           ? "flat"
           : transformStyleValue;
         const render3d = hasChildren && (perspective !== undefined || transformStyleValue === "preserve-3d")
           ? { transformStyle: effectiveTransformStyleValue as "flat" | "preserve-3d", ...(perspective ? { perspective } : {}) }
           : undefined;
         const backfaceVisibilityValue = (style.get("backface-visibility") ?? "visible").trim().toLowerCase();
         if (backfaceVisibilityValue !== "visible" && backfaceVisibilityValue !== "hidden") fail("css-backface-visibility-unsupported", `Unsupported backface-visibility value: ${backfaceVisibilityValue}`);
         const backfaceVisibility = backfaceVisibilityValue as "visible" | "hidden";
         const transformFor = (translateX: number, translateY: number, includeCssTransform: boolean) => {
           const cssOperations = includeCssTransform ? parsedTransform.operations ?? [] : [];
           const operations = cssOperations.length ? cssOperations : undefined;
           const hasOrderedTransform = cssOperations.length > 0;
           return {
             translate: { x: (motion ? 0 : translateX) + (includeCssTransform && !hasOrderedTransform ? parsedTransform.translate.x : 0), y: (motion ? 0 : translateY) + (includeCssTransform && !hasOrderedTransform ? parsedTransform.translate.y : 0), z: includeCssTransform && !hasOrderedTransform ? parsedTransform.translate.z : 0 },
             scale: includeCssTransform ? parsedTransform.scale : { x: 1, y: 1, z: 1 },
             rotate: includeCssTransform ? parsedTransform.rotate : { x: 0, y: 0, z: 0 },
             skew: includeCssTransform ? parsedTransform.skew : { x: 0, y: 0 },
             anchor: includeCssTransform ? parsedTransform.anchor : { x: 0, y: 0, z: 0 },
             ...(operations ? { operations } : {}),
             ...(includeCssTransform && parsedTransform.extensions ? { extensions: parsedTransform.extensions } : {}),
           };
         };
         const cornerRadius = parseCornerRadii(style, w, h, font, viewport);
         const outline = parseOutline(style, containingWidth, font, viewport);
         const currentColor = style.get("color") ?? parentStyle.get("color") ?? "#000000";
         const animationTracks = lowerAnimationTracks(style, keyframes, {
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
         const paintAnimationTracks = [
           ...animationTracks.paint.filter((track) => track.path === "style.fill"),
           ...animationTracks.group.filter((track) => track.path === "frame.width" || track.path === "frame.height"),
         ];
         const borderAnimationTracks = animationTracks.paint.filter((track) => track.path === "style.stroke" || track.path === "style.strokeWidth");
         const textShadows = parseShadows(style, "text-shadow", containingWidth, font, viewport, currentColor);
         const boxShadows = parseShadows(style, "box-shadow", containingWidth, font, viewport, currentColor);
         const filterEffects = parseFilter(style.get("filter"), containingWidth, font, viewport, currentColor);
         const paintEffects = [...boxShadows, ...filterEffects];
         const textEffects = [...paintEffects, ...textShadows];
         const composite = parseComposite(style);
         const compositeState = composite ? { composite } : {};
         const compositeNeedsGroup = composite !== undefined;
         const hasOutline = outline.style !== "none" && outline.width > 0;
         const emitOutline = (insideGroup: boolean) => {
           if (!hasOutline) return;
           const parentLayerId = insideGroup ? groupId : parentId;
           const transform = insideGroup ? transformFor(0, 0, false) : transformFor(localX, localY, true);
           // Border orders reserve a later paint band (including z-index
           // offsets), so outline must explicitly be emitted above that band.
           const outlineOrder = Number.isFinite(zIndex)
             ? Math.max(0, 100000 + (zIndex as number)) + 2000000
             : layers.length + 2000000;
           if (cornerRadius === undefined || cornerRadius === 0) {
             // A rectangular outline is a filled paint band. Four side
             // polygons avoid the inner contour antialias seam that Skia can
             // expose when a negative-offset even-odd ring overlaps a border.
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
         const maskLayerRefs = lowerMaskImages(node, style, style.get("color") ?? parentStyle.get("color") ?? "#000000", w, h);
         if (node.tag === "img") {
           const source = mediaSource(node);
           const fit = parseImageFit(style);
           const align = parseObjectPosition(style);
           const imageRendering = parseImageRendering(style);
           const imageAspect = fit === "fill"
             ? { align: "none" as const }
             : { align, ...(fit === "cover" ? { meetOrSlice: "slice" as const } : fit === "contain" ? { meetOrSlice: "meet" as const } : {}) };
            const clipPathId = elementClipPath();
            layers.push({ id: groupId, type: "image", parentLayerId: parentId, order: layers.length, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(paintEffects.length ? { effects: paintEffects } : {}), ...(animationTracks.group.length ? { tracks: animationTracks.group } : {}), timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "image", source), x: 0, y: 0, width: w, height: h, fit, preserveAspectRatio: imageAspect, ...(imageRendering ? { imageRendering } : {}) } });
           emitOutline(false);
           return;
         }
          if (node.tag === "video") {
            const source = mediaSource(node);
            const fit = parseImageFit(style);
             const clipPathId = elementClipPath();
            layers.push({ id: groupId, type: "video", parentLayerId: parentId, order: layers.length, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(paintEffects.length ? { effects: paintEffects } : {}), ...(animationTracks.group.length ? { tracks: animationTracks.group } : {}), timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "video", source), fit } });
            emitOutline(false);
            return;
          }
          const rawText = node.text.normalize("NFC");
          const text = hasChildren ? rawText.trim() : rawText;
          if (text) {
            if (hasChildren) fail("html-text-children-unsupported", "Text elements cannot contain child elements in the typography MVP");
            const font = resolveFontAssets(style, options.fontAssets ?? []);
            addAssets(font.assets.map(protocolFontAsset));
            const textColor = parseColor(style.get("color") ?? parentStyle.get("color") ?? "#000000", "color");
            const textAlign = parseTextAlign(style.get("text-align"));
            const renderTextAlign = textAlign === "match-parent" ? parseTextAlign(parentStyle.get("text-align")) : textAlign;
            const direction = parseTextDirection(style.get("direction"));
            const writingMode = parseWritingMode(style.get("writing-mode"));
            const textDecoration = parseTextDecoration(style.get("text-decoration"), textColor, containingWidth, number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont, viewport);
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
            const textClipId = style.get("overflow") === "hidden"
              ? registerClipPath([{ type: "rect", x: geometry.borderEdges[3] + geometry.padding[3], y: geometry.borderEdges[0] + geometry.padding[0], width: geometry.contentWidth, height: geometry.contentHeight }], "html-text-clip")
              : elementClipPath();
            const letterSpacing = parseTextSpacing(style.get("letter-spacing"), "letter-spacing", containingWidth, number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont, viewport);
            const wordSpacing = parseTextSpacing(style.get("word-spacing"), "word-spacing", containingWidth, number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont, viewport);
            layers.push({
              id: groupId,
              type: "text",
              parentLayerId: parent?.tag === "body" ? null : (parent?.atomicId ?? null),
              order: layerOrder,
              frame: { width: w, height: h },
              transform: transformFor(localX, localY, true),
              opacity,
              ...state,
              ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}),
              ...(motion ? { motion } : {}),
              ...compositeState,
              ...(textEffects.length ? { effects: textEffects } : {}),
              ...(textClipId ? { clipPath: textClipId } : {}),
              ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}),
              ...(animationTracks.group.length ? { tracks: animationTracks.group } : {}),
              timing: { start: 0, duration },
              payload: {
                source: { text, language: node.attributes.get("lang") ?? "und", direction, writingMode, whiteSpace: "default", textRendering },
                layout: { sizing, lineHeight: parseLineHeight(style, number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont, viewport), contentWidth: geometry.contentWidth, contentHeight: geometry.contentHeight, contentOffsetX: geometry.borderEdges[3] + geometry.padding[3], contentOffsetY: geometry.borderEdges[0] + geometry.padding[0], textAlign, whiteSpace, wrap, textOverflow, ...(textOverflow === "ellipsis" ? { maxLines: 1 } : {}) },
                chunks: [{
                  id: `${groupId}::chunk`,
                  sourceRange: { start: 0, end: text.length },
                  textAnchor: textAnchorForTextAlign(renderTextAlign, direction),
                    spans: [{
                    id: `${groupId}::span`,
                    sourceRange: { start: 0, end: text.length },
                    resolvedFontAssetIds: font.assets.map((asset) => asset.id),
                    font: { families: font.families, size: number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont, weight: font.weight, style: font.style, stretch: font.stretch },
                    letterSpacing,
                    wordSpacing,
                    ...(textDecoration ? { textDecoration } : {}),
                    fill: textColor,
                  }],
                }],
              },
            });
            emitOutline(false);
            return;
          }
          const backgroundShorthand = style.get("background")?.trim(); const backgroundValue = backgroundShorthand && (/^\w+-gradient\(/i.test(backgroundShorthand) || backgroundShorthand.includes(",")) ? backgroundShorthand : style.get("background-color") ?? backgroundShorthand; const paints = backgroundValue === undefined ? (hasChildren && ["svg", "g"].includes(node.tag) ? [] : ["#00000000" as Paint]) : parsePaintLayers(backgroundValue, "background", style.get("color") ?? parentStyle.get("color") ?? "#000000", { width: w, height: h }); const border = parseBorderEdges(style, containingWidth, font, viewport);
          const backgroundImages = parseBackgroundImages(style, style.get("color") ?? parentStyle.get("color") ?? "#000000", { width: w, height: h });
          const boxFor = (box: BackgroundBox): LayoutRect => backgroundBox(geometry, box);
          const paintBoxFor = (index: number): LayoutRect => boxFor(parseBackgroundBox(style, "background-clip", index));
          const borderBox = boxFor("border-box");
         const isPath = node.tag === "path";
         const pathContours = isPath ? parseSvgPathData(node.attributes.get("d") ?? "") : undefined;
         const pathStyle = isPath ? parsePathStyle(node, style, style.get("color") ?? parentStyle.get("color") ?? "#000000") : undefined;
         const fillRuleValue = (style.get("fill-rule") ?? node.attributes.get("fill-rule") ?? "nonzero").toLowerCase();
         if (isPath && !["nonzero", "evenodd"].includes(fillRuleValue)) fail("css-path-fill-rule-invalid", `Unsupported fill-rule: ${fillRuleValue}`);
         if (isPath) {
           const styleForPath = pathStyle?.fill || pathStyle?.stroke ? pathStyle : { ...(pathStyle ?? {}), fill: "#000000" };
           if (styleForPath.fill && pathContours!.some((contour) => !contour.closed)) fail("svg-path-fill-open", "Filled SVG paths must close every contour with Z");
           const clipPathId = elementClipPath();
           layers.push({ id: groupId, type: "path", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(paintEffects.length ? { effects: paintEffects } : {}), ...(animationTracks.group.length || animationTracks.paint.length ? { tracks: [...animationTracks.group, ...animationTracks.paint] } : {}), timing: { start: 0, duration }, payload: { contours: pathContours!, fillRule: fillRuleValue as "nonzero" | "evenodd" }, style: styleForPath });
        } else {
          // Keep all generated paint passes inside the element's stacking
          // scope. A border is a separate pass so its centered stroke can be
          // inset without changing the element's sibling order.
          const hasBorder = Object.values(border).some((side) => side.width > 0 && side.style !== "none");
           const clipPathId = elementClipPath();
           const needsPaintGroup = hasChildren || backgroundImages.length > 0 || maskLayerRefs !== undefined || hasBorder || hasOutline || paintEffects.length > 0 || compositeNeedsGroup || clipPathId !== undefined || motion !== undefined || animationTracks.group.length > 0 || animationTracks.paint.length > 0 || render3d !== undefined || backfaceVisibility !== "visible";
           // Element opacity belongs to the stacking group. Generated paint
           // passes are children of that group and must remain opaque, or a
           // non-default CSS opacity would be multiplied twice by runtime.
           const paintOpacity = needsPaintGroup ? 1 : opacity;
           if (needsPaintGroup) layers.push({ id: groupId, type: "group", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...(backfaceVisibility !== "visible" ? { backfaceVisibility } : {}), ...(motion ? { motion } : {}), ...compositeState, ...(paintEffects.length ? { effects: paintEffects } : {}), ...(clipPathId ? { clipPath: clipPathId } : {}), ...(maskLayerRefs ? { maskLayers: maskLayerRefs } : {}), ...(render3d ? { render3d } : {}), ...(animationTracks.group.length ? { tracks: animationTracks.group } : {}), timing: { start: 0, duration } });
           const paintLayerBaseOrder = layers.length;
           paints.forEach((fill, index) => {
          const paintId = paints.length === 1 ? (needsPaintGroup ? `${groupId}::paint` : groupId) : `${groupId}::paint:${index}`;
          const paintBox = paintBoxFor(index);
          // CSS background layers are painted back-to-front: the last
          // listed layer is underneath the first listed layer. Protocol V2
          // draws larger order values later, so reverse only this paint-layer
          // offset while keeping the source array and generated ids stable.
          const paintOrderOffset = paints.length > 1 ? paints.length - index - 1 : 0;
          const order = Number.isFinite(zIndex)
            ? Math.max(0, 100000 + (zIndex as number)) + paintOrderOffset
            : paintLayerBaseOrder + paintOrderOffset;
          const paintTransform = transformFor(needsPaintGroup ? paintBox.x : localX + paintBox.x, needsPaintGroup ? paintBox.y : localY + paintBox.y, !needsPaintGroup);
          if (typeof cornerRadius === "object") {
            // CanvasKit currently has a backend-specific fill gap for some
            // generated path contours. A union of local rectangle/ellipse
            // atoms keeps the exact CSS rounded silhouette while the border
            // itself remains a path contour below.
            roundedRectFillPieces(paintBox.width, paintBox.height, cornerRadius).forEach((piece, pieceIndex) => layers.push({ id: `${paintId}:fill:${pieceIndex}`, type: "shape", parentLayerId: needsPaintGroup ? groupId : parentId, order: order + pieceIndex, frame: { width: piece.width, height: piece.height }, transform: transformFor((needsPaintGroup ? paintBox.x : localX + paintBox.x) + piece.x, (needsPaintGroup ? paintBox.y : localY + paintBox.y) + piece.y, !needsPaintGroup), opacity: paintOpacity, ...state, ...(paintAnimationTracks.length ? { tracks: paintAnimationTracks } : {}), timing: { start: 0, duration }, payload: { shape: piece.shape }, style: { fill } }));
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
               if (image.type === "paint") {
                 layers.push({ id, type: "shape", parentLayerId, order, frame: { width: drawWidth, height: drawHeight }, transform: transformFor(drawX, drawY, false), opacity: paintOpacity, ...state, clipPath: clipId, timing: { start: 0, duration }, payload: { shape: "rectangle" }, style: { fill: image.paint } });
                 return;
               }
               const preserveAspectRatio = fit === "fill" ? { align: "none" as const } : { align, ...(fit === "cover" ? { meetOrSlice: "slice" as const } : fit === "contain" ? { meetOrSlice: "meet" as const } : {}) };
               layers.push({ id, type: "image", parentLayerId, order, frame: { width: drawWidth, height: drawHeight }, transform: transformFor(drawX, drawY, false), opacity: paintOpacity, ...state, clipPath: clipId, timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "image", image.uri, `background-${imageIndex}-${tileIndex}-asset`), x: 0, y: 0, width: drawWidth, height: drawHeight, fit, preserveAspectRatio } });
             };
             backgroundImages.forEach((image, imageIndex) => {
               const origin = boxFor(parseBackgroundBox(style, "background-origin", imageIndex));
               const clipBox = boxFor(parseBackgroundBox(style, "background-clip", imageIndex));
               const position = parseBackgroundPosition(style, imageIndex);
               const size = parseBackgroundSize(style, imageIndex, origin.width, origin.height);
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
             if (uniformBorder && typeof cornerRadius === "object") layers.push({
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
          layoutOverrides.set(placement.node, placement);
          layout(placement.node, node, placement.x, placement.y, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style, childContainingBlock);
          layoutOverrides.delete(placement.node);
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
          layoutOverrides.set(placement.node, placement);
          layout(placement.node, node, placement.x, placement.y, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style, childContainingBlock);
          layoutOverrides.delete(placement.node);
        }
        for (const child of node.children) {
          const childStyle = styles.get(child) ?? style;
          if ((childStyle.get("position") ?? "static") === "absolute") layout(child, node, childContainingBlock.x, childContainingBlock.y, childContainingBlock.width, childContainingBlock.height, style, childContainingBlock);
        }
      } else {
        layoutFlowChildren(node.children, node, childX, childY, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style, childContainingBlock, { flowY: childY, previousBottomMargin: 0, hasFlowChild: false });
      }
      // Outline is a paint-only pass. Emit it after descendants so it remains
      // on top of the element's content without affecting layout geometry.
    }
    const rootContainingBlock: ContainingBlock = compositionRect(width, height);
    if (body) layoutFlowChildren(body.children, body, 0, 0, width, height, bodyStyle, rootContainingBlock, { flowY: 0, previousBottomMargin: 0, hasFlowChild: false }); else layoutFlowChildren(root.children, null, 0, 0, width, height, new Map(), rootContainingBlock, { flowY: 0, previousBottomMargin: 0, hasFlowChild: false });
    const protocol = MotionProtocolV2Schema.parse({ format: "motion-protocol", formatVersion: 2, id: options.composition?.id ?? "gold-01-rectangle-solid-v1", composition: { width, height, fps, background: backgroundColor, colorSpace: composition.colorSpace, view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } } }, assets, layers, ...(clipPaths.length ? { clipPaths } : {}), ...(masks.length ? { masks } : {}), audio: { sampleRate: 48000, tracks: [] } });
    return { status: "success", source, protocol, diagnostics: [] };
  } catch (error) { const diagnostic = error instanceof CompileError ? { severity: "error" as const, code: error.code, message: error.message, ...(error.source ? { source: error.source } : {}) } : { severity: "error" as const, code: "html-compiler-internal", message: error instanceof Error ? error.message : String(error) }; return { status: "error", source, protocol: null, diagnostics: [diagnostic] }; }
}
