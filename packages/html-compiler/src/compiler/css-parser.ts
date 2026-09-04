import { fail, CompileError, sourceLocation } from "./errors";
import { splitTopLevel } from "./utils";
import { SUPPORTED_PROPERTIES, type Declaration, type Rule } from "./model";

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
    const property = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (!value) throw new CompileError("css-empty-value", `Empty value for ${property}`, location);
    const important = /\s!important\s*$/i.test(value);
    const normalizedValue = important ? value.replace(/\s!important\s*$/i, "").trim() : value;
    if (property === "display" && !["none", "block", "contents", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-display-unsupported", "Phase 3 supports display:none, block and contents", location);
    if (property === "position" && !["static", "relative", "absolute", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-position-invalid", "position must be static, relative or absolute", location);
    if (property === "visibility" && !["visible", "hidden", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-visibility-invalid", "visibility must be visible or hidden", location);
    if (property === "overflow" && !["visible", "hidden", "initial", "inherit", "unset"].includes(normalizedValue.toLowerCase())) throw new CompileError("css-overflow-invalid", "overflow must be visible or hidden", location);
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
