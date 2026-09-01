import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export type HtmlCssSource = { html: string; css: string };
export type HtmlCompilerSourceLocation = { kind: "html" | "css"; offset: number; line: number; column: number };
export type HtmlCompilerDiagnostic = { severity: "info" | "warning" | "error"; code: string; message: string; source?: HtmlCompilerSourceLocation; selector?: string; property?: string; elementId?: string };
export type HtmlCompilerOptions = { composition?: { width?: number; height?: number; fps?: number; durationMs?: number; id?: string } };
export type HtmlCompilerResult = { status: "success" | "error"; source: HtmlCssSource; protocol: MotionProtocolV2 | null; diagnostics: HtmlCompilerDiagnostic[] };

export function createHtmlCssSource(input: Partial<HtmlCssSource> = {}): HtmlCssSource {
  return { html: input.html ?? "", css: input.css ?? "" };
}

class CompileError extends Error { constructor(readonly code: string, message: string, readonly source?: HtmlCompilerSourceLocation) { super(message); } }
const fail = (code: string, message: string): never => { throw new CompileError(code, message); };
function sourceLocation(text: string, offset: number, kind: "html" | "css"): HtmlCompilerSourceLocation { const safeOffset = Math.max(0, Math.min(offset, text.length)); const before = text.slice(0, safeOffset); const line = before.split("\n").length; const lastNewline = before.lastIndexOf("\n"); return { kind, offset: safeOffset, line, column: safeOffset - lastNewline }; }
const SUPPORTED = new Set(["position", "left", "right", "top", "bottom", "width", "height", "min-width", "max-width", "min-height", "max-height", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "box-sizing", "background", "background-color", "color", "opacity", "font-size", "font-family", "display", "visibility", "z-index", "border", "border-width", "border-style", "border-color", "border-radius", "transform", "transform-origin", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linejoin", "stroke-linecap", "stroke-dasharray", "stroke-dashoffset"]);
const SUPPORTED_TAGS = new Set(["div", "span", "main", "section", "article", "header", "footer", "nav", "aside", "body", "svg", "g", "path"]);
const INHERITED = new Set(["color", "font-size", "font-family", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linejoin", "stroke-linecap", "stroke-dasharray", "stroke-dashoffset"]);
const EXPLICIT_ID = /^[A-Za-z][A-Za-z0-9_-]{0,199}$/;
const CLASS_TOKEN = /^-?(?:[A-Za-z_]|[A-Za-z_][A-Za-z0-9_-]*)[A-Za-z0-9_-]*$/;

type Node = { tag: string; id?: string; atomicId: string; structuralPath: string; classes: string[]; attributes: Map<string, string>; children: Node[]; parent: Node | null; order: number; style: Map<string, string> };
type Rule = { selectors: string[]; declarations: Map<string, string>; order: number };
type Style = Map<string, string>;

function splitTopLevel(input: string, separator: string): string[] {
  const result: string[] = []; let depth = 0; let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i]; if (c === "(") depth += 1; else if (c === ")") depth -= 1;
    if (depth === 0 && input.startsWith(separator, i)) { result.push(input.slice(start, i).trim()); start = i + separator.length; i += separator.length - 1; }
  }
  result.push(input.slice(start).trim()); return result.filter(Boolean);
}

function declarations(body: string, selector: string, sourceText?: string, sourceOffset = 0): Map<string, string> {
  const map = new Map<string, string>(); let partOffset = 0;
  for (const part of splitTopLevel(body, ";")) {
    const declarationOffset = body.indexOf(part, partOffset); partOffset = declarationOffset >= 0 ? declarationOffset + part.length : partOffset;
    const location = sourceText ? sourceLocation(sourceText, sourceOffset + Math.max(0, declarationOffset), "css") : undefined;
    const index = part.indexOf(":"); if (index <= 0) { const error = new CompileError("css-invalid-declaration", `Invalid declaration in ${selector}: ${part}`, location); throw error; }
    const property = part.slice(0, index).trim().toLowerCase(); const value = part.slice(index + 1).trim();
    if (!value) { const error = new CompileError("css-empty-value", `Empty value for ${property}`, location); throw error; }
    if (/\s!important\s*$/i.test(value)) { const error = new CompileError("css-important-unsupported", `!important is reserved for a later cascade phase`, location); throw error; }
    if (property === "display" && !["none", "block", "contents"].includes(value.toLowerCase())) { const error = new CompileError("css-display-unsupported", `Phase 3 supports display:none, block and contents`, location); throw error; }
    if (property === "position" && !["static", "relative", "absolute"].includes(value.toLowerCase())) { const error = new CompileError("css-position-invalid", `position must be static, relative or absolute`, location); throw error; }
    if (property === "visibility" && !["visible", "hidden"].includes(value.toLowerCase())) { const error = new CompileError("css-visibility-invalid", `visibility must be visible or hidden`, location); throw error; }
    if (!property.startsWith("--") && !SUPPORTED.has(property)) { const error = new CompileError("css-property-unsupported", `Phase 2 does not support ${property}`, location); throw error; }
    map.set(property, value);
  }
  return map;
}

function parseRules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, ""); const rules: Rule[] = []; let consumed = 0; let order = 0;
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const start = match.index ?? 0; if (text.slice(consumed, start).trim()) fail("css-invalid-rule", "CSS contains text outside a supported rule");
    const selectorText = match[1]!.trim(); if (!selectorText) fail("css-invalid-selector", "Empty selector");
    rules.push({ selectors: splitTopLevel(selectorText, ","), declarations: declarations(match[2]!, selectorText, text, start), order: order++ }); consumed = start + match[0].length;
  }
  if (text.slice(consumed).trim()) fail("css-invalid-rule", "CSS rule is missing a closing brace"); return rules;
}

function parseHtml(html: string): Node {
  const root: Node = { tag: "root", atomicId: "dom", structuralPath: "dom", classes: [], attributes: new Map(), children: [], parent: null, order: 0, style: new Map() }; const stack: Node[] = [root]; const explicitIds = new Set<string>(); let order = 0;
  const token = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|([^<]+)/g;
  for (const match of html.matchAll(token)) {
    if (match[1]?.trim()) fail("html-text-unsupported", "Phase 2 accepts empty elements; text layout is compiler Phase 3");
    const raw = match[0]!; if (raw.startsWith("<!--")) continue;
    if (/^<\//.test(raw)) { const name = raw.match(/^<\/\s*([\w-]+)/)?.[1]?.toLowerCase(); const index = stack.map((n) => n.tag).lastIndexOf(name ?? ""); if (index < 1) fail("html-invalid-close", `Unexpected closing tag ${name}`); stack.length = index; continue; }
    const matchTag = raw.match(/^<\s*([\w-]+)/); if (!matchTag) continue; const tag = matchTag[1]!.toLowerCase(); if (!SUPPORTED_TAGS.has(tag)) { throw new CompileError("html-tag-unsupported", `Phase 2 does not support <${tag}>`, sourceLocation(html, match.index ?? 0, "html")); }
    const id = raw.match(/(?:^|\s)id\s*=\s*["']([^"']+)["']/i)?.[1]; const dataAtomicId = raw.match(/\bdata-atomic-id\s*=\s*["']([^"']+)["']/i)?.[1]; const atomicId = dataAtomicId ?? id; if (atomicId) { if (!EXPLICIT_ID.test(atomicId)) fail("html-identity-invalid", `Atomic identity must match ${EXPLICIT_ID.source}: ${atomicId}`); if (explicitIds.has(atomicId)) fail("html-duplicate-atomic-id", `Duplicate atomic identity: ${atomicId}`); explicitIds.add(atomicId); }
    const classValue = raw.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? ""; const classes = [...new Set(classValue.split(/\s+/).filter(Boolean))]; for (const className of classes) if (!CLASS_TOKEN.test(className)) fail("html-class-invalid", `Invalid class token: ${className}`);
    const attributes = new Map<string, string>(); for (const attribute of raw.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes.set(attribute[1]!.toLowerCase(), attribute[2] ?? attribute[3] ?? "");
    const style = raw.match(/\bstyle\s*=\s*["'][^"']*["']/i); if (style) fail("html-inline-style-unsupported", "Inline style is reserved for a later compiler phase");
    if (/\bon[a-z]+\s*=\s*["']/i.test(raw)) { throw new CompileError("html-event-unsupported", "Event attributes are not part of the visual-only compiler", sourceLocation(html, match.index ?? 0, "html")); }
    const parent = stack[stack.length - 1]!; const structuralPath = `${parent.structuralPath}/${tag}:${parent.children.length}`;
    const node: Node = { tag, id, atomicId: atomicId ?? structuralPath, structuralPath, classes, attributes, children: [], parent, order: order++, style: new Map() }; parent.children.push(node);
    if (!/\/\s*>$/.test(raw) && !["meta", "link", "img", "br", "input"].includes(tag)) stack.push(node);
  }
  if (stack.length !== 1) fail("html-unclosed-tag", `Unclosed tag ${stack[stack.length - 1]!.tag}`); return root;
}

function specificity(selector: string): [number, number, number] {
  const id = (selector.match(/#[\w-]+/g) ?? []).length; const cls = (selector.match(/\.[\w-]+/g) ?? []).length; const tag = selector.replace(/[#.][\w-]+/g, "").trim() && selector.replace(/[#.][\w-]+/g, "").trim() !== "*" ? 1 : 0; return [id, cls, tag];
}
function matches(node: Node, selector: string): boolean {
  if (selector.trim() === ":root") return node.tag === "body" || node.tag === "root";
  const parts = selector.trim().split(/\s+/); if (parts.length > 1) { const last = parts.pop()!; if (!matches(node, last)) return false; let parent = node.parent; for (let i = parts.length - 1; i >= 0; i -= 1) { while (parent && !matches(parent, parts[i]!)) parent = parent.parent; if (!parent) return false; parent = parent.parent; } return true; }
  const simple = selector.trim(); if (!simple || /[>+~:[\]]/.test(simple)) fail("css-selector-unsupported", `Unsupported selector: ${selector}`);
  const tag = simple.match(/^[A-Za-z][\w-]*/)?.[0].toLowerCase(); if (tag && node.tag !== tag) return false; const id = simple.match(/#([\w-]+)/)?.[1]; if (id && node.id !== id) return false; for (const cls of simple.matchAll(/\.([\w-]+)/g)) { if (!CLASS_TOKEN.test(cls[1]!)) fail("css-class-invalid", `Invalid class token in selector: ${cls[1]}`); if (!node.classes.includes(cls[1]!)) return false; } return true;
}

function computed(node: Node, rules: Rule[], parent: Style): Style {
  const candidates = new Map<string, { value: string; score: [number, number, number, number] }>();
  for (const rule of rules) for (const selector of rule.selectors) if (matches(node, selector)) { const s = specificity(selector); for (const [property, value] of rule.declarations) { const score: [number, number, number, number] = [s[0], s[1], s[2], rule.order]; const previous = candidates.get(property); if (!previous || score.some((v, i) => v > previous.score[i]! && score.slice(0, i).every((x, j) => x === previous.score[j]))) candidates.set(property, { value, score }); } }
  for (const [property, value] of node.style) candidates.set(property, { value, score: [1000, 0, 0, 0] });
  const style = new Map<string, string>(); for (const [property, value] of parent) if (INHERITED.has(property) || property.startsWith("--")) style.set(property, value); for (const [property, item] of candidates) style.set(property, item.value); return style;
}

function parseColor(value: string, property: string): string {
  const v = value.trim().toLowerCase(); if (v === "transparent") return "#00000000"; if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`; if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(v)) fail("css-color-unsupported", `${property} must resolve to a hex color: ${value}`); return v;
}

type CompiledPathContour = Extract<MotionProtocolV2["layers"][number], { type: "path" }>["payload"]["contours"][number];
type CompiledPathSegment = CompiledPathContour["segments"][number];
type PathPoint = CompiledPathContour["start"];

/** Parse the deterministic SVG path subset that maps directly to V2 contours. */
function parseSvgPathData(value: string, property = "path d"): CompiledPathContour[] {
  const tokens = [...value.matchAll(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)].map((match) => match[0]!);
  if (tokens.length === 0) fail("svg-path-empty", `${property} must contain path data`);
  const isCommand = (token: string | undefined): boolean => token !== undefined && /^[A-Za-z]$/.test(token);
  const contours: CompiledPathContour[] = [];
  let cursor: PathPoint = { x: 0, y: 0 };
  let command: string | undefined;
  let contour: { id: string; start: PathPoint; segments: CompiledPathSegment[]; closed: boolean } | undefined;
  let contourIndex = 0;
  let index = 0;
  const readNumber = (): number => {
    const token = tokens[index++];
    if (token === undefined || isCommand(token)) fail("svg-path-invalid", `${property} contains an incomplete command`);
    const number = Number(token); if (!Number.isFinite(number)) fail("svg-path-invalid", `${property} contains a non-finite coordinate`); return number;
  };
  const point = (x: number, y: number, relative: boolean): PathPoint => relative ? { x: cursor.x + x, y: cursor.y + y } : { x, y };
  const finishContour = () => {
    if (!contour) return;
    if (contour.segments.length === 0) fail("svg-path-invalid", `${property} contour ${contour.id} has no segments`);
    contours.push(contour as CompiledPathContour); contour = undefined;
  };
  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) fail("svg-path-invalid", `${property} must begin with a command`);
    const activeCommand = command!;
    const relative = activeCommand === activeCommand.toLowerCase();
    const kind = activeCommand.toUpperCase();
    if (kind === "Z") {
      if (!contour) fail("svg-path-invalid", `${property} close command has no contour`);
      const activeContour = contour!;
      if (cursor.x !== activeContour.start.x || cursor.y !== activeContour.start.y) activeContour.segments.push({ kind: "line", to: activeContour.start });
      activeContour.closed = true; cursor = activeContour.start; command = undefined; continue;
    }
    if (!["M", "L", "H", "V", "C"].includes(kind)) fail("svg-path-command-unsupported", `${property} command ${command} is not supported; use M, L, H, V, C or Z`);
    if (kind === "M") {
      if (isCommand(tokens[index])) fail("svg-path-invalid", `${property} move command requires coordinates`);
      const next = point(readNumber(), readNumber(), relative);
      finishContour(); contour = { id: `contour-${contourIndex++}`, start: next, segments: [], closed: false }; cursor = next; command = relative ? "l" : "L"; continue;
    }
    if (!contour) fail("svg-path-invalid", `${property} drawing command has no initial move`);
    const activeContour = contour!;
    if (kind === "L") {
      if (isCommand(tokens[index])) fail("svg-path-invalid", `${property} line command requires coordinates`);
      const next = point(readNumber(), readNumber(), relative); activeContour.segments.push({ kind: "line", to: next }); cursor = next; continue;
    }
    if (kind === "H") {
      const x = readNumber(); const next = relative ? { x: cursor.x + x, y: cursor.y } : { x, y: cursor.y }; activeContour.segments.push({ kind: "line", to: next }); cursor = next; continue;
    }
    if (kind === "V") {
      const y = readNumber(); const next = relative ? { x: cursor.x, y: cursor.y + y } : { x: cursor.x, y }; activeContour.segments.push({ kind: "line", to: next }); cursor = next; continue;
    }
    if (isCommand(tokens[index])) fail("svg-path-invalid", `${property} cubic command requires six coordinates`);
    const control1 = point(readNumber(), readNumber(), relative); const control2 = point(readNumber(), readNumber(), relative); const next = point(readNumber(), readNumber(), relative);
    activeContour.segments.push({ kind: "cubic", control1, control2, to: next }); cursor = next;
  }
  finishContour();
  return contours;
}

function parsePathNumber(value: string | undefined, property: string, positive = false): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value.trim().replace(/px$/i, ""));
  if (!Number.isFinite(number) || (positive && number <= 0)) fail("css-path-value-invalid", `${property} must be ${positive ? "a positive " : "a finite "}number: ${value}`);
  return number;
}

function parsePathDash(value: string | undefined): { array: number[]; offset?: number } | undefined {
  if (value === undefined || value.trim().toLowerCase() === "none") return undefined;
  const parts = value.split(/\s*,\s*|\s+/).filter(Boolean);
  return { array: parts.map((part) => parsePathNumber(part, "stroke-dasharray", true)!) };
}

function parsePathStyle(node: Node, style: Style): { fill?: string; fillOpacity?: number; stroke?: string; strokeWidth?: number; strokeOpacity?: number; strokeJoin?: "miter" | "bevel" | "round"; strokeCap?: "butt" | "square" | "round"; strokeDash?: { array: number[]; offset?: number } } {
  const fillValue = style.get("fill") ?? node.attributes.get("fill"); const strokeValue = style.get("stroke") ?? node.attributes.get("stroke");
  const fill = fillValue === undefined || fillValue.toLowerCase() === "none" ? undefined : parseColor(fillValue, "fill");
  const stroke = strokeValue === undefined || strokeValue.toLowerCase() === "none" ? undefined : parseColor(strokeValue, "stroke");
  const fillOpacity = parsePathNumber(style.get("fill-opacity") ?? node.attributes.get("fill-opacity"), "fill-opacity");
  const strokeWidth = parsePathNumber(style.get("stroke-width") ?? node.attributes.get("stroke-width"), "stroke-width", true);
  const strokeOpacity = parsePathNumber(style.get("stroke-opacity") ?? node.attributes.get("stroke-opacity"), "stroke-opacity");
  if (fillOpacity !== undefined && (fillOpacity < 0 || fillOpacity > 1)) fail("css-path-opacity-invalid", "fill-opacity must be between 0 and 1");
  if (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1)) fail("css-path-opacity-invalid", "stroke-opacity must be between 0 and 1");
  const strokeJoinValue = (style.get("stroke-linejoin") ?? node.attributes.get("stroke-linejoin"))?.toLowerCase();
  const strokeCapValue = (style.get("stroke-linecap") ?? node.attributes.get("stroke-linecap"))?.toLowerCase();
  if (strokeJoinValue !== undefined && !["miter", "bevel", "round"].includes(strokeJoinValue)) fail("css-path-stroke-join-invalid", `Unsupported stroke-linejoin: ${strokeJoinValue}`);
  if (strokeCapValue !== undefined && !["butt", "square", "round"].includes(strokeCapValue)) fail("css-path-stroke-cap-invalid", `Unsupported stroke-linecap: ${strokeCapValue}`);
  const dashValue = style.get("stroke-dasharray") ?? node.attributes.get("stroke-dasharray"); const dash = parsePathDash(dashValue);
  const dashOffset = parsePathNumber(style.get("stroke-dashoffset") ?? node.attributes.get("stroke-dashoffset"), "stroke-dashoffset");
  const strokeDash = dash ? { ...dash, ...(dashOffset === undefined ? {} : { offset: dashOffset }) } : undefined;
  return { ...(fill === undefined ? {} : { fill }), ...(fillOpacity === undefined ? {} : { fillOpacity }), ...(stroke === undefined ? {} : { stroke }), ...(strokeWidth === undefined ? {} : { strokeWidth }), ...(strokeOpacity === undefined ? {} : { strokeOpacity }), ...(strokeJoinValue === undefined ? {} : { strokeJoin: strokeJoinValue as "miter" | "bevel" | "round" }), ...(strokeCapValue === undefined ? {} : { strokeCap: strokeCapValue as "butt" | "square" | "round" }), ...(strokeDash === undefined ? {} : { strokeDash }) };
}

type GradientStop = { offset: number; color: string };
type Paint = string | { type: "linear-gradient"; angle?: number; stops: GradientStop[] } | { type: "radial-gradient"; cx?: number; cy?: number; radius?: number; stops: GradientStop[] } | { type: "conic-gradient"; from?: number; cx?: number; cy?: number; stops: GradientStop[] };

function parseStopOffset(value: string | undefined, property: string): number | undefined {
  if (value === undefined) return undefined;
  const match = value.match(/^(-?(?:\d+\.?\d*|\.\d+))(%)?$/);
  if (!match) fail("css-gradient-stop-invalid", `${property} has an invalid color-stop offset: ${value}`);
  const parsed = match as RegExpMatchArray;
  const offset = Number(parsed[1]) / (parsed[2] ? 100 : 1);
  if (!Number.isFinite(offset) || offset < 0 || offset > 1) fail("css-gradient-stop-invalid", `${property} color-stop offset must be between 0% and 100%: ${value}`);
  return offset;
}

function normalizeStops(parts: string[], property: string): GradientStop[] {
  if (parts.length < 2) fail("css-gradient-invalid", `${property} requires at least two color stops`);
  const stops = parts.map((part) => {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0]) fail("css-gradient-stop-invalid", `${property} contains an empty color stop`);
    return { color: parseColor(tokens[0], property), offset: parseStopOffset(tokens[1], property) };
  });
  if (stops[0]!.offset === undefined) stops[0]!.offset = 0;
  if (stops[stops.length - 1]!.offset === undefined) stops[stops.length - 1]!.offset = 1;
  let index = 0;
  while (index < stops.length) {
    if (stops[index]!.offset !== undefined) { index += 1; continue; }
    const start = index - 1;
    while (index < stops.length && stops[index]!.offset === undefined) index += 1;
    const end = index;
    const from = stops[start]!.offset!;
    const to = stops[end]!.offset!;
    for (let i = start + 1; i < end; i += 1) stops[i]!.offset = from + ((to - from) * (i - start)) / (end - start);
  }
  for (let i = 1; i < stops.length; i += 1) if (stops[i]!.offset! < stops[i - 1]!.offset!) stops[i]!.offset = stops[i - 1]!.offset!;
  return stops as GradientStop[];
}

function isPaintToken(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}(?:[0-9a-f]{2})?)$/i.test(value) || value.toLowerCase() === "transparent";
}

function parseGradient(value: string, property: string): Exclude<Paint, string> {
  const match = value.trim().match(/^(linear|radial|conic)-gradient\((.*)\)$/i);
  if (!match) fail("css-gradient-unsupported", `${property} supports linear-gradient(), radial-gradient() and conic-gradient()`);
  const parsed = match as RegExpMatchArray;
  const kind = parsed[1]!.toLowerCase();
  const args = splitTopLevel(parsed[2]!, ",");
  if (args.length < 2) fail("css-gradient-invalid", `${property} gradient requires at least two color stops`);
  const descriptor = args[0]!.trim();
  const stopParts = isPaintToken(descriptor.split(/\s+/)[0] ?? "") ? args : args.slice(1);
  if (stopParts.length < 2) fail("css-gradient-invalid", `${property} gradient requires at least two color stops`);
  const stops = normalizeStops(stopParts, property);
  if (kind === "linear") {
    let angle: number | undefined;
    const angleMatch = descriptor.match(/^(-?(?:\d+\.?\d*|\.\d+))deg$/i);
    if (angleMatch) angle = Number(angleMatch[1]);
    else if (/^to\s+/i.test(descriptor)) {
      const direction = descriptor.toLowerCase().replace(/^to\s+/, "");
      const angles: Record<string, number> = { top: 0, right: 90, bottom: 180, left: 270, "top right": 45, "right top": 45, "bottom right": 135, "right bottom": 135, "bottom left": 225, "left bottom": 225, "top left": 315, "left top": 315 };
      angle = angles[direction];
      if (angle === undefined) fail("css-gradient-direction-invalid", `${property} does not support direction: ${descriptor}`);
    } else if (stopParts === args) angle = undefined;
    else fail("css-gradient-direction-invalid", `${property} has an invalid linear direction: ${descriptor}`);
    return angle === undefined ? { type: "linear-gradient", stops } : { type: "linear-gradient", angle, stops };
  }
  const center = descriptor.match(/\bat\s+(-?(?:\d+\.?\d*|\.\d+))%\s+(-?(?:\d+\.?\d*|\.\d+))%/i);
  if (kind === "radial") return center ? { type: "radial-gradient", cx: Number(center[1]) / 100, cy: Number(center[2]) / 100, stops } : { type: "radial-gradient", stops };
  const from = descriptor.match(/\bfrom\s+(-?(?:\d+\.?\d*|\.\d+))deg/i);
  return { type: "conic-gradient", ...(from ? { from: Number(from[1]) } : {}), ...(center ? { cx: Number(center[1]) / 100, cy: Number(center[2]) / 100 } : {}), stops };
}

function parsePaintLayers(value: string, property: string): Paint[] {
  const layers = splitTopLevel(value, ",");
  return layers.map((layer) => /^\w+-gradient\(/i.test(layer.trim()) ? parseGradient(layer, property) : parseColor(layer, property));
}

function parseBorder(style: Style, relative: number, fontSize: number, viewport: { width: number; height: number }): { color?: string; width?: number } {
  const shorthand = style.get("border");
  let widthValue = style.get("border-width");
  let styleValue = style.get("border-style");
  let colorValue = style.get("border-color");
  if (shorthand) {
    const tokens = shorthand.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (/^(solid|none)$/i.test(token)) styleValue = token.toLowerCase();
      else if (isPaintToken(token)) colorValue = token;
      else if (widthValue === undefined) widthValue = token;
      else fail("css-border-invalid", `Unsupported border token: ${token}`);
    }
  }
  if (styleValue !== undefined && !["solid", "none"].includes(styleValue.toLowerCase())) fail("css-border-style-unsupported", `Only solid and none borders are supported: ${styleValue}`);
  if (styleValue?.toLowerCase() === "none" || widthValue === undefined || widthValue === "0" || widthValue === "0px") return {};
  const width = calcExpression(widthValue, "border-width", relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(width) || width <= 0) fail("css-border-width-invalid", `Border width must be positive: ${widthValue}`);
  return { width, color: parseColor(colorValue ?? "#000000", "border-color") };
}

function parseCornerRadius(style: Style, relative: number, fontSize: number, viewport: { width: number; height: number }): number | undefined {
  const value = style.get("border-radius");
  if (value === undefined) return undefined;
  const parts = splitTopLevel(value, "/");
  const horizontal = parts[0]!.split(/\s+/).filter(Boolean);
  const vertical = (parts[1] ?? parts[0]!).split(/\s+/).filter(Boolean);
  if (horizontal.length !== 1 || vertical.length !== 1 || horizontal[0] !== vertical[0]) fail("css-border-radius-unsupported", "Phase 4 supports one uniform border-radius value");
  const radius = calcExpression(horizontal[0]!, "border-radius", relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(radius) || radius < 0) fail("css-border-radius-invalid", `Border radius must be non-negative: ${value}`);
  return radius;
}

type ParsedTransform = {
  translate: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotate: { x: number; y: number; z: number };
  skew: { x: number; y: number };
  anchor: { x: number; y: number; z: number };
  operations?: NonNullable<MotionProtocolV2["layers"][number]["transform"]["operations"]>;
  extensions?: NonNullable<MotionProtocolV2["layers"][number]["transform"]["extensions"]>;
};

function transformNumber(value: string, property: string, relative: number, fontSize: number, viewport: { width: number; height: number }): number {
  const parsed = calcExpression(value, property, relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(parsed)) fail("css-transform-value-invalid", `${property} requires a finite value: ${value}`);
  return parsed;
}

function transformAngle(value: string, property: string): number {
  const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(deg|rad|turn)$/i);
  if (!match) fail("css-transform-angle-invalid", `${property} requires an angle (deg, rad or turn): ${value}`);
  const parsed = match as RegExpMatchArray;
  const n = Number(parsed[1]); const unit = parsed[2]!.toLowerCase();
  return unit === "rad" ? (n * 180) / Math.PI : unit === "turn" ? n * 360 : n;
}

function parseTransformOrigin(value: string | undefined, width: number, height: number, fontSize: number, viewport: { width: number; height: number }): { x: number; y: number; z: number } {
  if (value === undefined) return { x: width / 2, y: height / 2, z: 0 };
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 3) fail("css-transform-origin-invalid", `transform-origin expects one to three values: ${value}`);
  const keywordX: Record<string, string> = { left: "0%", center: "50%", right: "100%" };
  const keywordY: Record<string, string> = { top: "0%", center: "50%", bottom: "100%" };
  const xValue = keywordX[tokens[0]!.toLowerCase()] ?? tokens[0]!;
  const yValue = keywordY[tokens[1]?.toLowerCase() ?? "center"] ?? tokens[1] ?? "50%";
  const x = transformNumber(xValue, "transform-origin", width, fontSize, viewport);
  const y = transformNumber(yValue, "transform-origin", height, fontSize, viewport);
  const z = tokens[2] === undefined ? 0 : transformNumber(tokens[2], "transform-origin", 1, fontSize, viewport);
  return { x, y, z };
}

function parseTransform(style: Style, width: number, height: number, fontSize: number, viewport: { width: number; height: number }): ParsedTransform {
  const identity: ParsedTransform = { translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 } };
  const value = style.get("transform");
  if (value === undefined || value.trim().toLowerCase() === "none") return identity;
  const result: ParsedTransform = { ...identity, anchor: parseTransformOrigin(style.get("transform-origin"), width, height, fontSize, viewport), operations: [] };
  const operationPattern = /([A-Za-z][\w-]*)\(([^()]*)\)/g; let cursor = 0; let match: RegExpExecArray | null;
  while ((match = operationPattern.exec(value)) !== null) {
    const parsedMatch = match as RegExpExecArray;
    if (value.slice(cursor, parsedMatch.index).trim()) fail("css-transform-invalid", `Unsupported transform syntax near ${value.slice(cursor, parsedMatch.index)}`);
    cursor = operationPattern.lastIndex;
    const name = parsedMatch[1]!.toLowerCase(); const args = parsedMatch[2]!.split(/\s*,\s*|\s+/).filter(Boolean);
    if (name === "translate" || name === "translate3d") {
      if (args.length < 1 || args.length > 3) fail("css-transform-arguments-invalid", `${name} expects one to three values`);
      const x = transformNumber(args[0]!, name, width, fontSize, viewport); const y = args[1] === undefined ? 0 : transformNumber(args[1], name, height, fontSize, viewport); const z = args[2] === undefined ? 0 : transformNumber(args[2], name, 1, fontSize, viewport);
      result.translate.x += x; result.translate.y += y; result.translate.z += z;
      result.operations!.push(z !== 0 || name === "translate3d"
        ? { type: "extension", name: "motion.translate3d", value: { x, y, z } }
        : { type: "translate", x, y });
    } else if (name === "translatex" || name === "translatey") {
      if (args.length !== 1) fail("css-transform-arguments-invalid", `${name} expects one value`);
      const x = name === "translatex" ? transformNumber(args[0]!, name, width, fontSize, viewport) : 0; const y = name === "translatey" ? transformNumber(args[0]!, name, height, fontSize, viewport) : 0;
      result.translate.x += x; result.translate.y += y; result.operations!.push({ type: "translate", x, y });
    } else if (name === "scale" || name === "scale3d") {
      if (args.length < 1 || args.length > 3) fail("css-transform-arguments-invalid", `${name} expects one to three values`);
      const x = Number(args[0]); const y = args[1] === undefined ? x : Number(args[1]); const z = args[2] === undefined ? 1 : Number(args[2]); if (![x, y, z].every(Number.isFinite)) fail("css-transform-value-invalid", `${name} requires numeric values`);
      result.scale.x *= x; result.scale.y *= y; result.scale.z *= z; result.operations!.push(name === "scale"
        ? { type: "scale", x, y }
        : { type: "extension", name: "motion.scale3d", value: { x, y, z } });
    } else if (name === "scalex" || name === "scaley") {
      if (args.length !== 1 || !Number.isFinite(Number(args[0]))) fail("css-transform-value-invalid", `${name} requires one numeric value`);
      const x = name === "scalex" ? Number(args[0]) : 1; const y = name === "scaley" ? Number(args[0]) : 1; result.scale.x *= x; result.scale.y *= y; result.operations!.push({ type: "scale", x, y });
    } else if (name === "rotate" || name === "rotatez" || name === "rotatex" || name === "rotatey") {
      if (args.length !== 1) fail("css-transform-arguments-invalid", `${name} expects one angle`);
      const angle = transformAngle(args[0]!, name); const x = name === "rotatex" ? angle : 0; const y = name === "rotatey" ? angle : 0; const z = name === "rotatex" || name === "rotatey" ? 0 : angle; result.rotate.x += x; result.rotate.y += y; result.rotate.z += z;
      result.operations!.push(name === "rotate" ? { type: "rotate", angle } : { type: "extension", name: name === "rotatex" ? "motion.rotateX" : name === "rotatey" ? "motion.rotateY" : "motion.rotateZ", value: angle });
    } else if (name === "skew" || name === "skewx" || name === "skewy") {
      if (args.length < 1 || args.length > 2) fail("css-transform-arguments-invalid", `${name} expects one or two angles`);
      const x = name === "skewy" ? 0 : transformAngle(args[0]!, name); const y = name === "skewy" ? transformAngle(args[0]!, name) : name === "skewx" ? 0 : args[1] === undefined ? 0 : transformAngle(args[1]!, name); result.skew.x += x; result.skew.y += y;
      if (x !== 0) result.operations!.push({ type: "skewX", angle: x });
      if (y !== 0) result.operations!.push({ type: "skewY", angle: y });
    } else fail("css-transform-function-unsupported", `Unsupported transform function: ${name}`);
  }
  if (value.slice(cursor).trim()) fail("css-transform-invalid", `Unsupported transform syntax near ${value.slice(cursor)}`);
  return result.operations!.length
    ? { ...result, extensions: { anchor: result.anchor } }
    : identity;
}

type Num = { value: number; unit: "px" | "%" | "number" };
function calcExpression(expression: string, property: string, relative: number, fontSize: number, rootFontSize: number, viewport: { width: number; height: number }): Num {
  const text = expression.trim(); if (text === "auto") return { value: Number.NaN, unit: "px" }; const calc = text.match(/^calc\((.*)\)$/i)?.[1] ?? text;
  const terms = splitTopLevel(calc.replace(/\s*([+\-*/])\s*/g, " $1 "), " ");
  if (terms.length === 1) { const match = terms[0]!.match(/^(-?(?:\d+\.?\d*|\.\d+))(px|%|em|rem|vw|vh)?$/i); if (!match) fail("css-value-invalid", `${property} has invalid numeric value: ${expression}`); const n = Number(match![1]!); const u = (match![2] ?? "number").toLowerCase(); if (u === "px" || u === "number") return { value: n, unit: u === "px" ? "px" : "number" }; if (u === "%") return { value: n / 100 * relative, unit: "px" }; if (u === "em") return { value: n * fontSize, unit: "px" }; if (u === "rem") return { value: n * rootFontSize, unit: "px" }; if (u === "vw") return { value: n / 100 * viewport.width, unit: "px" }; return { value: n / 100 * viewport.height, unit: "px" }; }
  let result = calcExpression(terms[0]!, property, relative, fontSize, rootFontSize, viewport); for (let i = 1; i < terms.length; i += 2) { const op = terms[i]; const rhs = calcExpression(terms[i + 1]!, property, relative, fontSize, rootFontSize, viewport); if (op === "+" || op === "-") { if (result.unit !== rhs.unit && !(result.unit === "px" && rhs.unit === "number") && !(result.unit === "number" && rhs.unit === "px")) fail("css-calc-incompatible", `Incompatible calc units in ${expression}`); result = { value: op === "+" ? result.value + rhs.value : result.value - rhs.value, unit: result.unit === "px" || rhs.unit === "px" ? "px" : "number" }; } else if (op === "*") { if (result.unit !== "number" && rhs.unit !== "number") fail("css-calc-incompatible", `Multiplication requires a number in ${expression}`); result = { value: result.value * rhs.value, unit: result.unit === "number" ? rhs.unit : result.unit }; } else { if (rhs.value === 0 || rhs.unit !== "number") fail("css-calc-incompatible", `Division requires a non-zero number in ${expression}`); result = { value: result.value / rhs.value, unit: result.unit }; } } return result;
}
function resolveVar(value: string, vars: Map<string, string>, seen: Set<string>): string {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]+))?\)/g, (_full, name: string, fallback?: string) => { if (seen.has(name)) { if (fallback) return fallback.trim(); fail("css-variable-cycle", `Cyclic variable ${name}`); } const resolved = vars.get(name); if (resolved === undefined) { if (fallback) return fallback.trim(); fail("css-variable-missing", `Missing variable ${name}`); } return resolveVar(resolved!, vars, new Set([...seen, name])); });
}
function number(style: Style, property: string, relative: number, fontSize: number, rootFontSize: number, viewport: { width: number; height: number }): number {
  const value = style.get(property); if (value === undefined) return Number.NaN; return calcExpression(value, property, relative, fontSize, rootFontSize, viewport).value;
}
function edges(style: Style, prefix: "margin" | "padding", relative: number, fontSize: number, rootFontSize: number, viewport: { width: number; height: number }): [number, number, number, number] {
  const shorthand = style.get(prefix); const values = shorthand ? splitTopLevel(shorthand, " ") : []; const expanded = values.length === 1 ? [values[0], values[0], values[0], values[0]] : values.length === 2 ? [values[0], values[1], values[0], values[1]] : values.length === 3 ? [values[0], values[1], values[2], values[1]] : values.length >= 4 ? values.slice(0, 4) : [undefined, undefined, undefined, undefined];
  return ["top", "right", "bottom", "left"].map((side, i) => { const value = style.get(`${prefix}-${side}`) ?? expanded[i]; return value === undefined ? 0 : calcExpression(value, `${prefix}-${side}`, relative, fontSize, rootFontSize, viewport).value; }) as [number, number, number, number];
}

export function compileHtmlCss(source: HtmlCssSource, options: HtmlCompilerOptions = {}): HtmlCompilerResult {
  try {
    const composition = options.composition ?? {}; const width = composition.width ?? 1920; const height = composition.height ?? 1080; const fps = composition.fps ?? 30; const duration = composition.durationMs ?? 1000; const root = parseHtml(source.html); const rules = parseRules(source.css); const viewport = { width, height }; const body = root.children.find((node) => node.tag === "body"); const vars = new Map<string, string>(); for (const rule of rules) for (const [property, value] of rule.declarations) if (property.startsWith("--")) vars.set(property, value);
    const allNodes: Node[] = []; const visit = (node: Node) => { allNodes.push(node); node.children.forEach(visit); }; root.children.forEach(visit); const styles = new Map<Node, Style>();
     const walkStyles = (node: Node, parent: Style) => { const style = computed(node, rules, parent); const scopedVars = new Map(vars); for (const [property, value] of style) if (property.startsWith("--")) scopedVars.set(property, value); for (const [property, value] of [...style]) { const resolved = resolveVar(value, scopedVars, new Set()); if (property === "background" || property === "background-color") parsePaintLayers(resolved, property); else if (property === "color" || property === "border-color" || property === "fill" || property === "stroke") { if (!(property === "fill" || property === "stroke") || resolved.toLowerCase() !== "none") parseColor(resolved, property); } style.set(property, resolved); } styles.set(node, style); node.children.forEach((child) => walkStyles(child, style)); }; if (body) walkStyles(body, new Map()); else root.children.forEach((child) => walkStyles(child, new Map()));
    for (const node of allNodes) for (const [property, value] of styles.get(node) ?? []) if (property.startsWith("--")) vars.set(property, value);
    if (body && !styles.has(body)) styles.set(body, computed(body, rules, new Map())); const bodyStyle = body ? styles.get(body)! : new Map<string, string>(); const background = parseColor(bodyStyle.get("background-color") ?? bodyStyle.get("background") ?? "#081018", "body background");
    const layers: MotionProtocolV2["layers"] = []; const origins = new Map<Node, { x: number; y: number }>(); const sizes = new Map<Node, { width: number; height: number }>(); const layout = (node: Node, parent: Node | null, parentX: number, parentY: number, containingWidth: number, containingHeight: number, parentStyle: Style) => {
      const style = styles.get(node) ?? computed(node, rules, parentStyle); const parentFont = number(parentStyle, "font-size", containingWidth, 16, 16, viewport) || 16; const font = number(style, "font-size", containingWidth, parentFont, 16, viewport) || parentFont; const margin = edges(style, "margin", containingWidth, font, 16, viewport); const padding = edges(style, "padding", containingWidth, font, 16, viewport); const positionMode = (style.get("position") ?? "static").toLowerCase(); const left = number(style, "left", containingWidth, font, 16, viewport); const top = number(style, "top", containingHeight, font, 16, viewport); const x = parentX + (positionMode === "static" ? margin[3] : Number.isFinite(left) ? left : margin[3]); const y = parentY + (positionMode === "static" ? margin[0] : Number.isFinite(top) ? top : margin[0]); const contentWidth = number(style, "width", containingWidth, font, 16, viewport); const contentHeight = number(style, "height", containingHeight, font, 16, viewport); const boxSizing = style.get("box-sizing")?.toLowerCase() === "border-box"; const requestedW = Number.isFinite(contentWidth) ? contentWidth + (boxSizing ? 0 : padding[1] + padding[3]) : containingWidth - margin[1] - margin[3]; const requestedH = Number.isFinite(contentHeight) ? contentHeight + (boxSizing ? 0 : padding[0] + padding[2]) : containingHeight - margin[0] - margin[2]; const w = Math.max(1, Math.min(Number.isFinite(number(style, "max-width", containingWidth, font, 16, viewport)) ? number(style, "max-width", containingWidth, font, 16, viewport) : Infinity, Math.max(Number.isFinite(number(style, "min-width", containingWidth, font, 16, viewport)) ? number(style, "min-width", containingWidth, font, 16, viewport) : 0, requestedW))); const h = Math.max(1, Math.min(Number.isFinite(number(style, "max-height", containingHeight, font, 16, viewport)) ? number(style, "max-height", containingHeight, font, 16, viewport) : Infinity, Math.max(Number.isFinite(number(style, "min-height", containingHeight, font, 16, viewport)) ? number(style, "min-height", containingHeight, font, 16, viewport) : 0, requestedH)));
      origins.set(node, { x, y }); sizes.set(node, { width: w, height: h });
      if (style.get("display") === "none") return;
      if (style.get("display") === "contents") { node.children.forEach((child) => layout(child, parent, parentX, parentY, containingWidth, containingHeight, parentStyle)); return; }
      if (node.tag !== "body" && style.get("display") !== "none") {
        const opacityValue = style.get("opacity"); const opacity = opacityValue === undefined ? 1 : Number(opacityValue); if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) fail("css-opacity-invalid", `opacity must be between 0 and 1: ${opacityValue}`);
        const parentId = parent?.tag === "body" ? null : (parent?.atomicId ?? null); const groupId = node.atomicId; const hasChildren = node.children.length > 0; const localX = parent?.children.length ? x - (origins.get(parent)?.x ?? parentX) : x; const localY = parent?.children.length ? y - (origins.get(parent)?.y ?? parentY) : y;
        const zIndexValue = style.get("z-index"); const zIndex = zIndexValue === undefined || zIndexValue === "auto" ? undefined : Number(zIndexValue); const layerOrder = Number.isFinite(zIndex) ? Math.max(0, 100000 + (zIndex as number)) : layers.length; const state = style.get("visibility") === "hidden" ? { enabled: false } : {};
         const backgroundValue = style.get("background") ?? style.get("background-color"); const paints = backgroundValue === undefined ? (hasChildren && ["svg", "g"].includes(node.tag) ? [] : ["#00000000" as Paint]) : parsePaintLayers(backgroundValue, "background"); const border = parseBorder(style, containingWidth, font, viewport); const cornerRadius = parseCornerRadius(style, containingWidth, font, viewport); const parsedTransform = parseTransform(style, w, h, font, viewport);
         const isPath = node.tag === "path";
         const pathContours = isPath ? parseSvgPathData(node.attributes.get("d") ?? "") : undefined;
         const pathStyle = isPath ? parsePathStyle(node, style) : undefined;
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
      const childX = x + padding[3]; const childY = y + padding[0]; let flowY = childY; node.children.forEach((child) => { const childStyle = styles.get(child) ?? style; const childPosition = childStyle.get("position") ?? "static"; layout(child, node, childX, flowY, Math.max(1, w - padding[1] - padding[3]), Math.max(1, h - padding[0] - padding[2]), style); if (childPosition !== "absolute") { const childOrigin = origins.get(child); const childSize = sizes.get(child); const childMargin = edges(childStyle, "margin", containingWidth, font, 16, viewport); flowY = (childOrigin?.y ?? flowY) + (childSize?.height ?? 0) + childMargin[2]; } });
    };
    if (body) body.children.forEach((node) => layout(node, body, 0, 0, width, height, bodyStyle)); else root.children.forEach((node) => layout(node, null, 0, 0, width, height, new Map()));
    const protocol = MotionProtocolV2Schema.parse({ format: "motion-protocol", formatVersion: 2, id: composition.id ?? "gold-01-rectangle-solid-v1", composition: { width, height, fps, background, colorSpace: "srgb", view: { projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 }, transform: { translate: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 } } } }, assets: [], layers, audio: { sampleRate: 48000, tracks: [] } });
    return { status: "success", source, protocol, diagnostics: [] };
  } catch (error) { const diagnostic = error instanceof CompileError ? { severity: "error" as const, code: error.code, message: error.message, ...(error.source ? { source: error.source } : {}) } : { severity: "error" as const, code: "html-compiler-internal", message: error instanceof Error ? error.message : String(error) }; return { status: "error", source, protocol: null, diagnostics: [diagnostic] }; }
}
