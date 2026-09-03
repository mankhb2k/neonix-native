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
import type { Node, Style } from "./compiler/model";

export function compileHtmlCss(source: HtmlCssSource, options: HtmlCompilerOptions = {}): HtmlCompilerResult {
  try {
    // The source envelope is the canonical composition contract. Keep the
    // legacy options as an escape hatch for duration/id, but never let them
    // make the browser and compiler disagree about the render viewport.
    const embeddedComposition = neonixManifest(source.html); const composition = { ...DEFAULT_HTML_CSS_COMPOSITION, ...(options.composition ?? {}), ...source.composition, ...(embeddedComposition ?? {}) }; if (composition.width !== 1920 || composition.height !== 1080 || composition.fps !== 30 || composition.background !== "#081018" || composition.colorSpace !== "srgb") fail("html-composition-invalid", "HTML/CSS sources must use the fixed 1920x1080 @ 30 composition with #081018 srgb"); const width = composition.width; const height = composition.height; const fps = composition.fps; const duration = options.composition?.durationMs ?? 1000; const root = parseHtml(withoutNeonixManifest(source.html)); const rules = parseRules(source.css); const viewport = { width, height }; const findNode = (node: Node, tag: string): Node | undefined => node.tag === tag ? node : node.children.map((child) => findNode(child, tag)).find(Boolean); const body = findNode(root, "body"); const rootVars = new Map<string, string>(); for (const rule of rules) if (rule.selectors.some((selector) => selector.trim() === ":root")) for (const declaration of rule.declarations) if (declaration.property.startsWith("--")) rootVars.set(declaration.property, declaration.value);
    const allNodes: Node[] = []; const visit = (node: Node) => { allNodes.push(node); node.children.forEach(visit); }; root.children.forEach(visit); const styles = new Map<Node, Style>();
     const walkStyles = (node: Node, parent: Style) => { const style = computed(node, rules, parent); const scopedVars = new Map<string, string>(); for (const [property, value] of style) if (property.startsWith("--")) scopedVars.set(property, value); for (const [property, value] of [...style]) { const resolved = resolveVar(value, scopedVars, new Set()); style.set(property, resolved); if (property.startsWith("--")) scopedVars.set(property, resolved); } const currentColor = style.get("color") ?? parent.get("color") ?? "#000000"; for (const [property, value] of style) { if (property === "background" || property === "background-color") parsePaintLayers(value, property, currentColor); else if (property === "color" || property === "border-color" || property === "fill" || property === "stroke") { if (!(property === "fill" || property === "stroke") || value.toLowerCase() !== "none") parseColor(value, property, currentColor); } } styles.set(node, style); node.children.forEach((child) => walkStyles(child, style)); }; if (body) walkStyles(body, rootVars); else root.children.forEach((child) => walkStyles(child, rootVars));
    if (body && !styles.has(body)) styles.set(body, computed(body, rules, new Map())); const bodyStyle = body ? styles.get(body)! : new Map<string, string>(); const backgroundColor = parseColor(composition.background, "composition background");
    const layers: MotionProtocolV2["layers"] = []; const origins = new Map<Node, { x: number; y: number }>(); const sizes = new Map<Node, { width: number; height: number }>(); const layout = (node: Node, parent: Node | null, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style) => {
      const style = styles.get(node) ?? computed(node, rules, parentStyle); const parentFont = number(parentStyle, "font-size", containingWidth, 16, 16, viewport) || 16; const font = number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont; const geometry = resolveGeometry({ style, parentX, parentY, containingWidth, containingHeight, fontSize: font, viewport }); const { x, y, width: w, height: h } = geometry;
      origins.set(node, { x, y }); sizes.set(node, { width: w, height: h });
      if (style.get("display") === "none") return;
      if (style.get("display") === "contents") { node.children.forEach((child) => layout(child, parent, parentX, parentY, containingWidth, containingHeight, parentStyle)); return; }
      if (node.tag !== "body" && style.get("display") !== "none" && w > 0 && h > 0) {
        const opacityValue = style.get("opacity"); const opacity = opacityValue === undefined ? 1 : Number(opacityValue); if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) fail("css-opacity-invalid", `opacity must be between 0 and 1: ${opacityValue}`);
        const parentId = parent?.tag === "body" ? null : (parent?.atomicId ?? null); const groupId = node.atomicId; const hasChildren = node.children.length > 0; const localX = parent?.children.length ? x - (origins.get(parent)?.x ?? parentX) : x; const localY = parent?.children.length ? y - (origins.get(parent)?.y ?? parentY) : y;
        const zIndexValue = style.get("z-index"); const zIndex = zIndexValue === undefined || zIndexValue === "auto" ? undefined : Number(zIndexValue); const layerOrder = Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : layers.length; const state = style.get("visibility") === "hidden" ? { enabled: false } : {};
         const backgroundShorthand = style.get("background")?.trim(); const backgroundValue = backgroundShorthand && (/^\w+-gradient\(/i.test(backgroundShorthand) || backgroundShorthand.includes(",")) ? backgroundShorthand : style.get("background-color") ?? backgroundShorthand; const paints = backgroundValue === undefined ? (hasChildren && ["svg", "g"].includes(node.tag) ? [] : ["#00000000" as Paint]) : parsePaintLayers(backgroundValue, "background", style.get("color") ?? parentStyle.get("color") ?? "#000000"); const border = parseBorder(style, containingWidth, font, viewport); const cornerRadius = parseCornerRadius(style, containingWidth, font, viewport); const parsedTransform = parseTransform(style, w, h, font, viewport);
         const isPath = node.tag === "path";
         const pathContours = isPath ? parseSvgPathData(node.attributes.get("d") ?? "") : undefined;
         const pathStyle = isPath ? parsePathStyle(node, style, style.get("color") ?? parentStyle.get("color") ?? "#000000") : undefined;
         const fillRuleValue = (style.get("fill-rule") ?? node.attributes.get("fill-rule") ?? "nonzero").toLowerCase();
         if (isPath && !["nonzero", "evenodd"].includes(fillRuleValue)) fail("css-path-fill-rule-invalid", `Unsupported fill-rule: ${fillRuleValue}`);
        const transformFor = (translateX: number, translateY: number, includeCssTransform: boolean) => {
          const cssOperations = includeCssTransform ? parsedTransform.operations ?? [] : [];
          const operations = cssOperations.length ? cssOperations : undefined;
          return {
            translate: { x: translateX + (includeCssTransform ? parsedTransform.translate.x : 0), y: translateY + (includeCssTransform ? parsedTransform.translate.y : 0), z: includeCssTransform ? parsedTransform.translate.z : 0 },
            scale: includeCssTransform ? parsedTransform.scale : { x: 1, y: 1, z: 1 },
            rotate: includeCssTransform ? parsedTransform.rotate : { x: 0, y: 0, z: 0 },
            skew: includeCssTransform ? parsedTransform.skew : { x: 0, y: 0 },
            anchor: includeCssTransform ? parsedTransform.anchor : { x: 0, y: 0, z: 0 },
            ...(operations ? { operations } : {}),
            ...(includeCssTransform && parsedTransform.extensions ? { extensions: parsedTransform.extensions } : {}),
          };
        };
         if (isPath) {
           const styleForPath = pathStyle?.fill || pathStyle?.stroke ? pathStyle : { ...(pathStyle ?? {}), fill: "#000000" };
           if (styleForPath.fill && pathContours!.some((contour) => !contour.closed)) fail("svg-path-fill-open", "Filled SVG paths must close every contour with Z");
           layers.push({ id: groupId, type: "path", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, timing: { start: 0, duration }, payload: { contours: pathContours!, fillRule: fillRuleValue as "nonzero" | "evenodd" }, style: styleForPath });
         } else {
           if (hasChildren) layers.push({ id: groupId, type: "group", parentLayerId: parentId, order: layerOrder, frame: { width: w, height: h }, transform: transformFor(localX, localY, true), opacity, ...state, timing: { start: 0, duration } });
           paints.forEach((fill, index) => {
          const paintId = paints.length === 1 ? (hasChildren ? `${groupId}::paint` : groupId) : `${groupId}::paint:${index}`;
          const isLast = index === paints.length - 1;
          layers.push({ id: paintId, type: "shape", parentLayerId: hasChildren ? groupId : parentId, order: Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) + index : layers.length, frame: { width: w, height: h }, transform: transformFor(hasChildren ? 0 : localX, hasChildren ? 0 : localY, !hasChildren), opacity, ...state, timing: { start: 0, duration }, payload: { shape: "rectangle", ...(cornerRadius !== undefined ? { cornerRadius } : {}) }, style: { fill, ...(isLast && border.color ? { stroke: border.color } : {}), ...(isLast && border.width ? { strokeWidth: border.width } : {}) } });
           });
         }
      }
      const childX = x + geometry.padding[3] + geometry.borderWidth; const childY = y + geometry.padding[0] + geometry.borderWidth; let flowY = childY; let previousBottomMargin = 0; let hasFlowChild = false; node.children.forEach((child) => { const childStyle = styles.get(child) ?? style; const childPosition = childStyle.get("position") ?? "static"; const childMargin = edges(childStyle, "margin", containingWidth, font, 16, viewport); if (childPosition === "absolute") { layout(child, node, childX, flowY, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style); return; } const topMargin = childMargin[0]; const collapsedMargin = hasFlowChild ? collapseVerticalMargins(previousBottomMargin, topMargin) : topMargin; const childParentY = flowY - topMargin + collapsedMargin; layout(child, node, childX, childParentY, Math.max(1, geometry.contentWidth), Math.max(1, geometry.contentHeight), style); if (childStyle.get("display") === "none") return; const childOrigin = origins.get(child); const childSize = sizes.get(child); flowY = (childOrigin?.y ?? childParentY) + (childSize?.height ?? 0); previousBottomMargin = childMargin[2]; hasFlowChild = true; });
    };
    if (body) body.children.forEach((node) => layout(node, body, 0, 0, width, height, bodyStyle)); else root.children.forEach((node) => layout(node, null, 0, 0, width, height, new Map()));
    const protocol = MotionProtocolV2Schema.parse({ format: "motion-protocol", formatVersion: 2, id: options.composition?.id ?? "gold-01-rectangle-solid-v1", composition: { width, height, fps, background: backgroundColor, colorSpace: composition.colorSpace, view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } } }, assets: [], layers, audio: { sampleRate: 48000, tracks: [] } });
    return { status: "success", source, protocol, diagnostics: [] };
  } catch (error) { const diagnostic = error instanceof CompileError ? { severity: "error" as const, code: error.code, message: error.message, ...(error.source ? { source: error.source } : {}) } : { severity: "error" as const, code: "html-compiler-internal", message: error instanceof Error ? error.message : String(error) }; return { status: "error", source, protocol: null, diagnostics: [diagnostic] }; }
}
