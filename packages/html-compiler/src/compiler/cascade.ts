import { fail } from "./errors";
import { expandShorthand } from "./cascade-values";
import { CLASS_TOKEN, INHERITED_PROPERTIES, type Node, type Rule, type Style } from "./model";

export function specificity(selector: string): [number, number, number] {
  const id = (selector.match(/#[\w-]+/g) ?? []).length;
  const cls = (selector.match(/\.[\w-]+/g) ?? []).length;
  const tagText = selector.replace(/[#.][\w-]+/g, "").trim();
  const tag = tagText && tagText !== "*" ? 1 : 0;
  return [id, cls, tag];
}

export function matches(node: Node, selector: string): boolean {
  if (selector.trim() === ":root") return node.tag === "body" || node.tag === "root";
  const parts = selector.trim().split(/\s+/);
  if (parts.length > 1) {
    const last = parts.pop()!;
    if (!matches(node, last)) return false;
    let parent = node.parent;
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      while (parent && !matches(parent, parts[i]!)) parent = parent.parent;
      if (!parent) return false;
      parent = parent.parent;
    }
    return true;
  }
  const simple = selector.trim();
  if (!simple || /[>+~:[\]]/.test(simple)) fail("css-selector-unsupported", `Unsupported selector: ${selector}`);
  const tag = simple.match(/^[A-Za-z][\w-]*/)?.[0].toLowerCase();
  if (tag && node.tag !== tag) return false;
  const id = simple.match(/#([\w-]+)/)?.[1];
  if (id && node.id !== id) return false;
  for (const cls of simple.matchAll(/\.([\w-]+)/g)) {
    if (!CLASS_TOKEN.test(cls[1]!)) fail("css-class-invalid", `Invalid class token in selector: ${cls[1]}`);
    if (!node.classes.includes(cls[1]!)) return false;
  }
  return true;
}

const INITIAL_VALUES: Record<string, string> = {
  position: "static", left: "auto", right: "auto", top: "auto", bottom: "auto", width: "auto", height: "auto", "min-width": "auto", "max-width": "none", "min-height": "auto", "max-height": "none", "aspect-ratio": "auto", "box-sizing": "content-box", background: "transparent", "background-color": "transparent", "background-image": "none", "background-position": "0% 0%", "background-size": "auto", "background-repeat": "repeat", "background-origin": "padding-box", "background-clip": "border-box", color: "#000000", opacity: "1", "font-size": "16px", "font-family": "sans-serif", "font-weight": "400", "font-style": "normal", "font-stretch": "normal", "line-height": "normal", "letter-spacing": "normal", "word-spacing": "normal", "white-space": "normal", "text-align": "start", direction: "ltr", "writing-mode": "horizontal-tb", "text-decoration": "none", "text-overflow": "clip", "text-rendering": "auto", display: "block", visibility: "visible", "z-index": "auto", overflow: "visible", outline: "none", "outline-width": "medium", "outline-style": "none", "outline-color": "currentColor", "outline-offset": "0px", "text-shadow": "none", "box-shadow": "none", "border-style": "none", "border-width": "0px", "border-radius": "0px", "border-color": "currentColor", fill: "#000000", "fill-opacity": "1", "fill-rule": "nonzero", stroke: "none", "stroke-width": "1px", "stroke-opacity": "1", "stroke-linejoin": "miter", "stroke-linecap": "butt", "stroke-dasharray": "none", "stroke-dashoffset": "0px", "paint-order": "normal", "flex-direction": "row", "flex-wrap": "nowrap", "justify-content": "flex-start", "justify-items": "stretch", "align-items": "stretch", "align-self": "auto", "align-content": "stretch", "place-items": "stretch", gap: "0px", "row-gap": "0px", "column-gap": "0px", flex: "0 1 auto", "flex-basis": "auto", "flex-grow": "0", "flex-shrink": "1", order: "0", "grid-template-columns": "none", "grid-template-rows": "none", "grid-column-start": "auto", "grid-column-end": "auto", "grid-row-start": "auto", "grid-row-end": "auto",
};
INITIAL_VALUES.filter = "none";
for (const side of ["top", "right", "bottom", "left"]) {
  INITIAL_VALUES[`border-${side}-style`] = "none";
  INITIAL_VALUES[`border-${side}-width`] = "0px";
  INITIAL_VALUES[`border-${side}-color`] = "currentColor";
}

type CascadeScore = [number, number, number, number, number, number];

function cascadeWins(next: CascadeScore, previous: CascadeScore): boolean {
  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== previous[index]) return next[index] > previous[index]!;
  }
  return false;
}

function resolveCascadeValue(property: string, value: string, parent: Style): string {
  const keyword = value.trim().toLowerCase();
  if (keyword === "initial") return INITIAL_VALUES[property] ?? value;
  if (keyword === "inherit" || (keyword === "unset" && (INHERITED_PROPERTIES.has(property) || property.startsWith("--")))) return parent.get(property) ?? INITIAL_VALUES[property] ?? value;
  if (keyword === "unset") return INITIAL_VALUES[property] ?? value;
  return value;
}

export function computed(node: Node, rules: Rule[], parent: Style): Style {
  const candidates = new Map<string, { value: string; score: CascadeScore }>();
  const consider = (property: string, value: string, score: CascadeScore) => {
    const previous = candidates.get(property);
    if (!previous || cascadeWins(score, previous.score)) candidates.set(property, { value, score });
  };
  for (const rule of rules) for (const selector of rule.selectors) if (matches(node, selector)) {
    const s = specificity(selector);
    for (const declaration of rule.declarations) for (const [property, value] of expandShorthand(declaration.property, declaration.value)) consider(property, value, [declaration.important ? 1 : 0, s[0], s[1], s[2], rule.order, declaration.order]);
  }
  for (const [property, value] of node.style) consider(property, value, [1, 1000, 0, 0, Number.MAX_SAFE_INTEGER, 0]);
  const style = new Map<string, string>();
  for (const [property, value] of parent) if (INHERITED_PROPERTIES.has(property) || property.startsWith("--")) style.set(property, value);
  for (const [property, item] of candidates) style.set(property, resolveCascadeValue(property, item.value, parent));
  return style;
}
