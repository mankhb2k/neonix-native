import { CompileError, fail, sourceLocation } from "../errors";
import { CLASS_TOKEN, EXPLICIT_ID, type Node } from "./dom-model";
import { SUPPORTED_TAGS } from "./tags";

export function parseHtml(html: string): Node {
  const root: Node = { tag: "root", atomicId: "dom", structuralPath: "dom", classes: [], attributes: new Map(), children: [], content: [], parent: null, order: 0, style: new Map(), text: "" };
  const stack: Node[] = [root];
  const explicitIds = new Set<string>();
  let order = 0;
  const token = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/?[A-Za-z][^>]*>|([^<]+)/gi;
  for (const match of html.matchAll(token)) {
    if (match[1] !== undefined) {
      const parent = stack[stack.length - 1]!;
      parent.text += match[1];
      parent.content.push(match[1]);
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
