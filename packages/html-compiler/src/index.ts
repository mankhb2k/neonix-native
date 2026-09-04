import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
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
import { parseRules } from "./compiler/css-parser";
import { computed } from "./compiler/cascade";
import { edges, number, resolveVar } from "./compiler/values";
import { parseBorder, parseColor, parseCornerRadius, parsePaintLayers, type Paint } from "./compiler/paint";
import { parsePathStyle, parseSvgPathData } from "./compiler/path";
import { parseTransform } from "./compiler/transform";
import { resolveGeometry } from "./compiler/geometry";
import { collapseVerticalMargins } from "./compiler/layout";
import { mediaMimeType, mediaSource, parseImageFit, parseImageRendering, parseObjectPosition } from "./compiler/media";
import { parseLineHeight, resolveFontAssets } from "./compiler/typography";
import type { Node, Style } from "./compiler/model";

function protocolFontAsset(asset: NonNullable<HtmlCompilerOptions["fontAssets"]>[number]): NonNullable<MotionProtocolV2["assets"]>[number] {
  return { id: asset.id, kind: "font", uri: asset.uri, weight: asset.weight, integrity: asset.integrity };
}

export function compileHtmlCss(source: HtmlCssSource, options: HtmlCompilerOptions = {}): HtmlCompilerResult {
  try {
    // The source envelope is the canonical composition contract. Keep the
    // legacy options as an escape hatch for duration/id, but never let them
    // make the browser and compiler disagree about the render viewport.
    const embeddedComposition = neonixManifest(source.html); const composition = { ...DEFAULT_HTML_CSS_COMPOSITION, ...(options.composition ?? {}), ...source.composition, ...(embeddedComposition ?? {}) }; if (composition.width !== 1920 || composition.height !== 1080 || composition.fps !== 30 || composition.background !== "#081018" || composition.colorSpace !== "srgb") fail("html-composition-invalid", "HTML/CSS sources must use the fixed 1920x1080 @ 30 composition with #081018 srgb"); const width = composition.width; const height = composition.height; const fps = composition.fps; const duration = options.composition?.durationMs ?? 1000; const root = parseHtml(withoutNeonixManifest(source.html)); const rules = parseRules(source.css); const viewport = { width, height }; const findNode = (node: Node, tag: string): Node | undefined => node.tag === tag ? node : node.children.map((child) => findNode(child, tag)).find(Boolean); const body = findNode(root, "body"); const rootVars = new Map<string, string>(); for (const rule of rules) if (rule.selectors.some((selector) => selector.trim() === ":root")) for (const declaration of rule.declarations) if (declaration.property.startsWith("--")) rootVars.set(declaration.property, declaration.value);
    const allNodes: Node[] = []; const visit = (node: Node) => { allNodes.push(node); node.children.forEach(visit); }; root.children.forEach(visit); const styles = new Map<Node, Style>();
     const walkStyles = (node: Node, parent: Style) => { const style = computed(node, rules, parent); const scopedVars = new Map<string, string>(); for (const [property, value] of style) if (property.startsWith("--")) scopedVars.set(property, value); for (const [property, value] of [...style]) { const resolved = resolveVar(value, scopedVars, new Set()); style.set(property, resolved); if (property.startsWith("--")) scopedVars.set(property, resolved); } const currentColor = style.get("color") ?? parent.get("color") ?? "#000000"; for (const [property, value] of style) { if (property === "background" || property === "background-color") parsePaintLayers(value, property, currentColor); else if (property === "color" || property === "border-color" || property === "fill" || property === "stroke") { if (!(property === "fill" || property === "stroke") || value.toLowerCase() !== "none") parseColor(value, property, currentColor); } } styles.set(node, style); node.children.forEach((child) => walkStyles(child, style)); }; if (body) walkStyles(body, rootVars); else root.children.forEach((child) => walkStyles(child, rootVars));
    if (body && !styles.has(body)) styles.set(body, computed(body, rules, new Map())); const bodyStyle = body ? styles.get(body)! : new Map<string, string>(); const backgroundColor = parseColor(composition.background, "composition background");
    type ContainingBlock = { x: number; y: number; width: number; height: number };
    type FlowState = { flowY: number; previousBottomMargin: number; hasFlowChild: boolean };
    const layers: MotionProtocolV2["layers"] = []; const assets: NonNullable<MotionProtocolV2["assets"]> = []; const clipPaths: NonNullable<MotionProtocolV2["clipPaths"]> = []; const origins = new Map<Node, { x: number; y: number }>(); const flowOrigins = new Map<Node, { x: number; y: number }>(); const sizes = new Map<Node, { width: number; height: number }>();
    const addAssets = (items: readonly NonNullable<MotionProtocolV2["assets"]>[number][]) => { for (const asset of items) if (!assets.some((candidate) => candidate.id === asset.id)) assets.push(asset); };
    const mediaAsset = (node: Node, kind: "image" | "video", uri: string) => {
      const id = `${node.atomicId}-asset`;
      if (!assets.some((asset) => asset.id === id)) assets.push({ id, kind, uri, mimeType: mediaMimeType(uri, kind) });
      return id;
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
      const style = styles.get(node) ?? computed(node, rules, parentStyle); const parentFont = number(parentStyle, "font-size", containingWidth, 16, 16, viewport) || 16; const font = number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont; const geometry = resolveGeometry({ style, parentX, parentY, containingWidth, containingHeight, fontSize: font, viewport }); const { x, y, normalX, normalY, width: w, height: h } = geometry;
      origins.set(node, { x, y }); sizes.set(node, { width: w, height: h });
      flowOrigins.set(node, { x: normalX, y: normalY });
      if (style.get("display") === "none") return;
      if (style.get("display") === "contents") { node.children.forEach((child) => layout(child, parent, parentX, parentY, containingWidth, containingHeight, parentStyle, positionedBlock)); return; }
      if (node.tag !== "body" && style.get("display") !== "none" && w > 0 && h > 0) {
        const opacityValue = style.get("opacity"); const opacity = opacityValue === undefined ? 1 : Number(opacityValue); if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) fail("css-opacity-invalid", `opacity must be between 0 and 1: ${opacityValue}`);
        const parentId = parent?.tag === "body" ? null : (parent?.atomicId ?? null); const groupId = node.atomicId; const hasChildren = node.children.length > 0; const localX = parent?.children.length ? x - (origins.get(parent)?.x ?? parentX) : x; const localY = parent?.children.length ? y - (origins.get(parent)?.y ?? parentY) : y;
        const zIndexValue = style.get("z-index"); const zIndex = zIndexValue === undefined || zIndexValue === "auto" ? undefined : Number(zIndexValue); const layerOrder = Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : layers.length; const state = style.get("visibility") === "hidden" ? { enabled: false } : {}; const overflowClipId = hasChildren && style.get("overflow") === "hidden" ? `html-overflow-clip-${clipPaths.length}` : undefined; if (overflowClipId) clipPaths.push({ id: overflowClipId, clipPathUnits: "userSpaceOnUse", children: [{ type: "rect", x: 0, y: 0, width: w, height: h }] });
         const parsedTransform = parseTransform(style, w, h, font, viewport);
         const transformFor = (translateX: number, translateY: number, includeCssTransform: boolean) => {
           const cssOperations = includeCssTransform ? parsedTransform.operations ?? [] : [];
           const operations = cssOperations.length ? cssOperations : undefined;
           const hasOrderedTransform = cssOperations.length > 0;
           return {
             translate: { x: translateX + (includeCssTransform && !hasOrderedTransform ? parsedTransform.translate.x : 0), y: translateY + (includeCssTransform && !hasOrderedTransform ? parsedTransform.translate.y : 0), z: includeCssTransform && !hasOrderedTransform ? parsedTransform.translate.z : 0 },
             scale: includeCssTransform ? parsedTransform.scale : { x: 1, y: 1, z: 1 },
             rotate: includeCssTransform ? parsedTransform.rotate : { x: 0, y: 0, z: 0 },
             skew: includeCssTransform ? parsedTransform.skew : { x: 0, y: 0 },
             anchor: includeCssTransform ? parsedTransform.anchor : { x: 0, y: 0, z: 0 },
             ...(operations ? { operations } : {}),
             ...(includeCssTransform && parsedTransform.extensions ? { extensions: parsedTransform.extensions } : {}),
           };
         };
         if (node.tag === "img") {
           const source = mediaSource(node);
           const fit = parseImageFit(style);
           const align = parseObjectPosition(style);
           const imageRendering = parseImageRendering(style);
           const imageAspect = fit === "fill"
             ? { align: "none" as const }
             : { align, ...(fit === "cover" ? { meetOrSlice: "slice" as const } : fit === "contain" ? { meetOrSlice: "meet" as const } : {}) };
           layers.push({ id: groupId, type: "image", parentLayerId: parent?.tag === "body" ? null : (parent?.atomicId ?? null), order: layers.length, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "image", source), x: 0, y: 0, width: w, height: h, fit, preserveAspectRatio: imageAspect, ...(imageRendering ? { imageRendering } : {}) } });
           return;
         }
          if (node.tag === "video") {
            const source = mediaSource(node);
            const fit = parseImageFit(style);
            layers.push({ id: groupId, type: "video", parentLayerId: parent?.tag === "body" ? null : (parent?.atomicId ?? null), order: layers.length, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, timing: { start: 0, duration }, payload: { assetId: mediaAsset(node, "video", source), fit } });
            return;
          }
          const text = node.text.trim().normalize("NFC");
          if (text) {
            if (hasChildren) fail("html-text-children-unsupported", "Text elements cannot contain child elements in the typography MVP");
            const font = resolveFontAssets(style, options.fontAssets ?? []);
            addAssets(font.assets.map(protocolFontAsset));
            const textColor = parseColor(style.get("color") ?? parentStyle.get("color") ?? "#000000", "color");
            layers.push({
              id: groupId,
              type: "text",
              parentLayerId: parent?.tag === "body" ? null : (parent?.atomicId ?? null),
              order: layerOrder,
              frame: { width: w, height: h },
              transform: transformFor(localX, localY, true),
              opacity,
              ...state,
              timing: { start: 0, duration },
              payload: {
                source: { text, language: node.attributes.get("lang") ?? "und", direction: "ltr", writingMode: "horizontal-tb", whiteSpace: "default", textRendering: "auto" },
                layout: { lineHeight: parseLineHeight(style, number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont, viewport), textAlign: "left", whiteSpace: "normal", wrap: "word", textOverflow: "clip" },
                chunks: [{
                  id: `${groupId}::chunk`,
                  sourceRange: { start: 0, end: text.length },
                  textAnchor: "start",
                    spans: [{
                    id: `${groupId}::span`,
                    sourceRange: { start: 0, end: text.length },
                    resolvedFontAssetIds: font.assets.map((asset) => asset.id),
                    font: { families: font.families, size: number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont, weight: font.weight, style: font.style, stretch: font.stretch },
                    fill: textColor,
                  }],
                }],
              },
            });
            return;
          }
          const backgroundShorthand = style.get("background")?.trim(); const backgroundValue = backgroundShorthand && (/^\w+-gradient\(/i.test(backgroundShorthand) || backgroundShorthand.includes(",")) ? backgroundShorthand : style.get("background-color") ?? backgroundShorthand; const paints = backgroundValue === undefined ? (hasChildren && ["svg", "g"].includes(node.tag) ? [] : ["#00000000" as Paint]) : parsePaintLayers(backgroundValue, "background", style.get("color") ?? parentStyle.get("color") ?? "#000000", { width: w, height: h }); const border = parseBorder(style, containingWidth, font, viewport); const cornerRadius = parseCornerRadius(style, containingWidth, font, viewport);
         const isPath = node.tag === "path";
         const pathContours = isPath ? parseSvgPathData(node.attributes.get("d") ?? "") : undefined;
         const pathStyle = isPath ? parsePathStyle(node, style, style.get("color") ?? parentStyle.get("color") ?? "#000000") : undefined;
         const fillRuleValue = (style.get("fill-rule") ?? node.attributes.get("fill-rule") ?? "nonzero").toLowerCase();
         if (isPath && !["nonzero", "evenodd"].includes(fillRuleValue)) fail("css-path-fill-rule-invalid", `Unsupported fill-rule: ${fillRuleValue}`);
         if (isPath) {
           const styleForPath = pathStyle?.fill || pathStyle?.stroke ? pathStyle : { ...(pathStyle ?? {}), fill: "#000000" };
           if (styleForPath.fill && pathContours!.some((contour) => !contour.closed)) fail("svg-path-fill-open", "Filled SVG paths must close every contour with Z");
           layers.push({ id: groupId, type: "path", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, timing: { start: 0, duration }, payload: { contours: pathContours!, fillRule: fillRuleValue as "nonzero" | "evenodd" }, style: styleForPath });
         } else {
           if (hasChildren) layers.push({ id: groupId, type: "group", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, ...(overflowClipId ? { clipPath: overflowClipId } : {}), timing: { start: 0, duration } });
           const paintLayerBaseOrder = layers.length;
           paints.forEach((fill, index) => {
          const paintId = paints.length === 1 ? (hasChildren ? `${groupId}::paint` : groupId) : `${groupId}::paint:${index}`;
          const isLast = index === paints.length - 1;
          // CSS background layers are painted back-to-front: the last
          // listed layer is underneath the first listed layer. Protocol V2
          // draws larger order values later, so reverse only this paint-layer
          // offset while keeping the source array and generated ids stable.
          const paintOrderOffset = paints.length > 1 ? paints.length - index - 1 : 0;
          const order = Number.isFinite(zIndex)
            ? Math.max(0, 100000 + (zIndex as number)) + paintOrderOffset
            : paintLayerBaseOrder + paintOrderOffset;
          layers.push({ id: paintId, type: "shape", parentLayerId: hasChildren ? groupId : parentId, order, frame: { width: w, height: h }, transform: transformFor(hasChildren ? 0 : localX, hasChildren ? 0 : localY, !hasChildren), opacity, ...state, timing: { start: 0, duration }, payload: { shape: "rectangle", ...(cornerRadius !== undefined ? { cornerRadius } : {}) }, style: { fill, ...(isLast && border.color ? { stroke: border.color } : {}), ...(isLast && border.width ? { strokeWidth: border.width } : {}) } });
           });
         }
      }
      const childX = x + geometry.padding[3] + geometry.borderWidth;
      const childY = y + geometry.padding[0] + geometry.borderWidth;
      const currentPosition = style.get("position") ?? "static";
      // CSS absolute descendants resolve against the nearest positioned
      // ancestor's padding box, while normal-flow children start in its
      // content box. Keeping these two coordinate spaces separate avoids
      // applying the parent's padding twice to an absolute child.
      const childContainingBlock = currentPosition === "relative" || currentPosition === "absolute"
        ? {
            x: x + geometry.borderWidth,
            y: y + geometry.borderWidth,
            width: Math.max(1, geometry.width - geometry.borderWidth * 2),
            height: Math.max(1, geometry.height - geometry.borderWidth * 2),
          }
        : positionedBlock;
      layoutFlowChildren(node.children, node, childX, childY, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style, childContainingBlock, { flowY: childY, previousBottomMargin: 0, hasFlowChild: false });
    }
    const rootContainingBlock: ContainingBlock = { x: 0, y: 0, width, height };
    if (body) layoutFlowChildren(body.children, body, 0, 0, width, height, bodyStyle, rootContainingBlock, { flowY: 0, previousBottomMargin: 0, hasFlowChild: false }); else layoutFlowChildren(root.children, null, 0, 0, width, height, new Map(), rootContainingBlock, { flowY: 0, previousBottomMargin: 0, hasFlowChild: false });
    const protocol = MotionProtocolV2Schema.parse({ format: "motion-protocol", formatVersion: 2, id: options.composition?.id ?? "gold-01-rectangle-solid-v1", composition: { width, height, fps, background: backgroundColor, colorSpace: composition.colorSpace, view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } } }, assets, layers, ...(clipPaths.length ? { clipPaths } : {}), audio: { sampleRate: 48000, tracks: [] } });
    return { status: "success", source, protocol, diagnostics: [] };
  } catch (error) { const diagnostic = error instanceof CompileError ? { severity: "error" as const, code: error.code, message: error.message, ...(error.source ? { source: error.source } : {}) } : { severity: "error" as const, code: "html-compiler-internal", message: error instanceof Error ? error.message : String(error) }; return { status: "error", source, protocol: null, diagnostics: [diagnostic] }; }
}
