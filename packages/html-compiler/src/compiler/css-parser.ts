import { fail, CompileError, sourceLocation } from "./errors";
import { splitTopLevel } from "./utils";
import { SUPPORTED_PROPERTIES, type Declaration, type KeyframeDefinition, type KeyframeStep, type Rule } from "./model";

export function declarations(body: string, selector: string, sourceText?: string, sourceOffset = 0): Declaration[] {
  const result: Declaration[] = [];
  let partOffset = 0;
  let declarationOrder = 0;
  for (const part of splitTopLevel(body, ";")) {
    const declarationOffset = body.indexOf(part, partOffset);
    partOffset = declarationOffset >= 0 ? declarationOffset + part.length : partOffset;
    const location = sourceText ? sourceLocation(sourceText, sourceOffset + Math.max(0, declarationOffset), "css") : undefined;
    const index = part.indexOf(":");
    if (index <= 0) throw new CompileError("css-invalid-declaration", `Invalid declaration in ${selector}: ${part}`, location);
    const rawProperty = part.slice(0, index).trim().toLowerCase();
    const vendorPrefix = /^-(?:webkit|moz|ms|o)-/.exec(rawProperty)?.[0];
    const property = vendorPrefix ? rawProperty.slice(vendorPrefix.length) : rawProperty;
    // A vendor-prefixed property with no supported unprefixed equivalent (e.g.
    // -webkit-user-select, -moz-osx-font-smoothing) is a browser-engine
    // extension Neonix never implements. Real browsers silently ignore a
    // declaration they don't recognize instead of failing the whole
    // stylesheet; match that instead of hard-failing the document, since
    // authors commonly carry these over from devtools/frameworks without
    // meaning to invoke anything Neonix-specific. An unprefixed unsupported
    // property still hard-fails below - that gap is real, not vendor cruft.
    if (vendorPrefix && !property.startsWith("--") && !SUPPORTED_PROPERTIES.has(property)) continue;
    const value = part.slice(index + 1).trim();
    if (!value) throw new CompileError("css-empty-value", `Empty value for ${property}`, location);
    const important = /\s!important\s*$/i.test(value);
    let normalizedValue = important ? value.replace(/\s!important\s*$/i, "").trim() : value;
    if (property === "white-space" && !["normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-white-space-unsupported", `Unsupported white-space value: ${normalizedValue}`, location);
    if (property === "text-align" && !["start", "end", "left", "right", "center", "justify", "match-parent", "justify-all", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-text-align-unsupported", `Unsupported text-align value: ${normalizedValue}`, location);
    if (property === "direction" && !["ltr", "rtl", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-direction-unsupported", `direction must be ltr or rtl: ${normalizedValue}`, location);
    if (property === "writing-mode" && !["horizontal-tb", "vertical-rl", "vertical-lr", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-writing-mode-unsupported", `Unsupported writing-mode value: ${normalizedValue}`, location);
    if (property === "display" && !["none", "block", "contents", "flex", "grid", "-webkit-box", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-display-unsupported", "P1.3 supports display:none, block, contents, flex and grid", location);
    // `-webkit-box` is the legacy flexbox syntax `-webkit-line-clamp` is
    // authored with; this compiler doesn't implement its full box-layout
    // semantics, only the line-clamp special case (see parseLineClamp), so
    // it behaves as `block` everywhere else layout dispatches on `display`.
    if (property === "display" && normalizedValue.toLowerCase() === "-webkit-box") normalizedValue = "block";
    if (property === "line-clamp" && normalizedValue.trim().toLowerCase() !== "none" && !/^\d+$/.test(normalizedValue.trim())) throw new CompileError("css-line-clamp-unsupported", `-webkit-line-clamp must be a positive integer or none: ${normalizedValue}`, location);
    if (property === "box-orient" && !["horizontal", "vertical", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-box-orient-unsupported", `-webkit-box-orient must be horizontal or vertical: ${normalizedValue}`, location);
    if (property === "flex-direction" && !["row", "row-reverse", "column", "column-reverse", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-flex-direction-unsupported", "flex-direction must be row, row-reverse, column or column-reverse", location);
    if (property === "flex-wrap" && !["nowrap", "wrap", "wrap-reverse", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-flex-wrap-unsupported", "P1.2 supports flex-wrap: nowrap, wrap or wrap-reverse", location);
    if (property === "justify-content" && !["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-flex-justify-unsupported", `Unsupported justify-content value: ${normalizedValue}`, location);
    if ((property === "align-items" || property === "align-self") && !["stretch", "flex-start", "flex-end", "center", "baseline", "auto", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-flex-align-unsupported", `Unsupported ${property} value: ${normalizedValue}`, location);
    if (property === "align-content" && !["stretch", "flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-flex-align-content-unsupported", `Unsupported align-content value: ${normalizedValue}`, location);
    if (property === "justify-items" && !["stretch", "start", "end", "center", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-grid-item-alignment-unsupported", `Unsupported justify-items value: ${normalizedValue}`, location);
    if (property === "position" && !["static", "relative", "absolute", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-position-invalid", "position must be static, relative or absolute", location);
    if (property === "visibility" && !["visible", "hidden", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-visibility-invalid", "visibility must be visible or hidden", location);
    if (property === "overflow" && !["visible", "hidden", "clip", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-overflow-invalid", "overflow must be visible, hidden or clip", location);
    // `clip` and `hidden` both mean "clip, don't scroll" for a compiled
    // video with no interactive scrolling; the only real CSS difference
    // (hidden is still programmatically scrollable) doesn't apply here, so
    // normalize clip to hidden once instead of teaching every consumer of
    // the overflow value about a second spelling.
    if (property === "overflow" && normalizedValue.toLowerCase() === "clip") normalizedValue = "hidden";
    if (property.endsWith("border-style") || property === "border-style") {
      const styles = normalizedValue.toLowerCase().split(/\s+/);
      if (styles.some((item) => !["solid", "none", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset", "initial", "inherit", "unset"].includes(item))) throw new CompileError("css-border-style-unsupported", `Unsupported border style: ${normalizedValue}`, location);
    }
    if (property === "text-overflow" && !["clip", "ellipsis", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-text-overflow-invalid", "text-overflow must be clip or ellipsis", location);
    if (property === "text-rendering" && !["auto", "optimizespeed", "geometricprecision", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-text-rendering-invalid", "text-rendering must be auto, optimizeSpeed or geometricPrecision", location);
    if (!property.startsWith("--") && !SUPPORTED_PROPERTIES.has(property)) throw new CompileError("css-property-unsupported", `Phase 2 does not support ${property}`, location);
    result.push({ property, value: normalizedValue, important, order: declarationOrder++ });
  }
  return result;
}

export function parseRules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  let consumed = 0;
  let order = 0;
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const start = match.index ?? 0;
    if (text.slice(consumed, start).trim()) fail("css-invalid-rule", "CSS contains text outside a supported rule");
    const selectorText = match[1]!.trim();
    if (!selectorText) fail("css-invalid-selector", "Empty selector");
    rules.push({ selectors: splitTopLevel(selectorText, ","), declarations: declarations(match[2]!, selectorText, text, start), order: order++ });
    consumed = start + match[0].length;
  }
  if (text.slice(consumed).trim()) fail("css-invalid-rule", "CSS rule is missing a closing brace");
  return rules;
}

/** Extract @keyframes before the ordinary rule parser sees nested blocks. */
export function parseAnimationStyles(css: string): { css: string; keyframes: Map<string, KeyframeDefinition> } {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const keyframes = new Map<string, KeyframeDefinition>();
  const pattern = /@(?:-webkit-)?keyframes\s+([A-Za-z_][\w-]*)\s*\{/gi;
  let cursor = 0;
  let output = "";
  let definitionOrder = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const open = text.indexOf("{", start);
    let depth = 0;
    let close = -1;
    for (let index = open; index < text.length; index += 1) {
      if (text[index] === "{") depth += 1;
      else if (text[index] === "}") {
        depth -= 1;
        if (depth === 0) { close = index; break; }
      }
    }
    if (close < 0) fail("css-keyframes-invalid", `@keyframes ${match[1]} is missing a closing brace`);
    output += text.slice(cursor, start);
    const body = text.slice(open + 1, close);
    const steps: KeyframeStep[] = [];
    let stepOrder = 0;
    for (const stepMatch of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectorText = stepMatch[1]!.trim();
      if (!selectorText) continue;
      const stepOffset = open + 1 + (stepMatch.index ?? 0);
      steps.push({
        selectors: splitTopLevel(selectorText, ","),
        declarations: declarations(stepMatch[2]!, `@keyframes ${match[1]} ${selectorText}`, text, stepOffset),
        order: stepOrder++,
      });
    }
    if (steps.length === 0) fail("css-keyframes-empty", `@keyframes ${match[1]} must contain at least one step`);
    const name = match[1]!;
    keyframes.set(name, { name, steps, order: definitionOrder++ });
    cursor = close + 1;
    pattern.lastIndex = cursor;
  }
  output += text.slice(cursor);
  return { css: output, keyframes };
}
