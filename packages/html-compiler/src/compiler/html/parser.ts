import { CompileError, fail, sourceLocation } from "../errors";
import { CLASS_TOKEN, EXPLICIT_ID, type Node } from "./dom-model";
import { SUPPORTED_TAGS } from "./tags";

const HTML_TEXT_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  copy: "©",
  deg: "°",
  divide: "÷",
  euro: "€",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsaquo: "‹",
  lsquo: "‘",
  mdash: "—",
  middot: "·",
  nbsp: "\u00a0",
  ndash: "–",
  not: "¬",
  plusmn: "±",
  pound: "£",
  raquo: "»",
  rdquo: "”",
  rsaquo: "›",
  rsquo: "’",
  times: "×",
  trade: "™",
  yen: "¥",
};

/** Decode the character references that the browser resolves in text nodes. */
function decodeHtmlText(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (match, token: string) => {
    if (token.toLowerCase().startsWith("#x")) {
      const codePoint = Number.parseInt(token.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    if (token.startsWith("#")) {
      const codePoint = Number.parseInt(token.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return HTML_TEXT_ENTITIES[token.toLowerCase()] ?? match;
  });
}

export function parseHtml(html: string): Node {
  const root: Node = { tag: "root", atomicId: "dom", structuralPath: "dom", classes: [], attributes: new Map(), children: [], content: [], parent: null, order: 0, style: new Map(), text: "" };
  const stack: Node[] = [root];
  const explicitIds = new Set<string>();
  let order = 0;
  const token = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/?[A-Za-z][^>]*>|([^<]+)/gi;
  for (const match of html.matchAll(token)) {
    if (match[1] !== undefined) {
      const parent = stack[stack.length - 1]!;
      const text = decodeHtmlText(match[1]);
      parent.text += text;
      parent.content.push(text);
      continue;
    }
    const raw = match[0]!;
    if (raw.startsWith("<!--") || /^<!DOCTYPE/i.test(raw)) continue;
    if (/^<\//.test(raw)) {
      const name = raw.match(/^<\/\s*([\w-]+)/)?.[1]?.toLowerCase();
      const index = stack.map((n) => n.tag).lastIndexOf(name ?? "");
      if (index < 1) fail("html-invalid-close", `Unexpected closing tag ${name}`);
      stack.length = index;
      continue;
    }
    const matchTag = raw.match(/^<\s*([\w-]+)/);
    if (!matchTag) continue;
    const tag = matchTag[1]!.toLowerCase();
    if (!SUPPORTED_TAGS.has(tag)) throw new CompileError("html-tag-unsupported", `Phase 2 does not support <${tag}>`, sourceLocation(html, match.index ?? 0, "html"));
    if (/\bdata-atomic-id\s*=\s*["']/i.test(raw)) throw new CompileError("html-attribute-unsupported", "data-atomic-id has been removed; use the standard id attribute", sourceLocation(html, match.index ?? 0, "html"));
    const id = raw.match(/(?:^|\s)id\s*=\s*["']([^"']+)["']/i)?.[1];
    const atomicId = id;
    if (atomicId) {
      if (!EXPLICIT_ID.test(atomicId)) fail("html-identity-invalid", `HTML id must match ${EXPLICIT_ID.source}: ${atomicId}`);
      if (explicitIds.has(atomicId)) fail("html-duplicate-atomic-id", `Duplicate HTML id: ${atomicId}`);
      explicitIds.add(atomicId);
    }
    const classValue = raw.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    const classes = [...new Set(classValue.split(/\s+/).filter(Boolean))];
    for (const className of classes) if (!CLASS_TOKEN.test(className)) fail("html-class-invalid", `Invalid class token: ${className}`);
    const attributes = new Map<string, string>();
    for (const attribute of raw.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes.set(attribute[1]!.toLowerCase(), attribute[2] ?? attribute[3] ?? "");
    if (/\bstyle\s*=\s*["'][^"']*["']/i.test(raw)) fail("html-inline-style-unsupported", "Inline style is reserved for a later compiler phase");
    if (/\bon[a-z]+\s*=\s*["']/i.test(raw)) throw new CompileError("html-event-unsupported", "Event attributes are not part of the visual-only compiler", sourceLocation(html, match.index ?? 0, "html"));
    const parent = stack[stack.length - 1]!;
    const structuralPath = `${parent.structuralPath}/${tag}:${parent.children.length}`;
    const node: Node = { tag, id, atomicId: atomicId ?? structuralPath, structuralPath, classes, attributes, children: [], content: [], parent, order: order++, style: new Map(), text: "" };
    parent.children.push(node);
    parent.content.push(node);
    if (!/\/\s*>$/.test(raw) && !["meta", "link", "img", "br", "input"].includes(tag)) stack.push(node);
  }
  if (stack.length !== 1) fail("html-unclosed-tag", `Unclosed tag ${stack[stack.length - 1]!.tag}`);
  return root;
}
