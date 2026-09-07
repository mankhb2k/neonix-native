import { TEXT_CONTAINER_TAGS, TEXT_TAGS } from "../html/tags";
import { fail } from "../errors";
import type { Node } from "../model";

export function isTextNode(node: Node): boolean {
  return TEXT_TAGS.has(node.tag);
}

export function isTextContainer(node: Node): boolean {
  return TEXT_CONTAINER_TAGS.has(node.tag);
}

export function collectTextContent(node: Node): string {
  return node.content.map((part) => {
    if (typeof part === "string") return part;
    if (part.tag === "br") return "\n";
    if (TEXT_TAGS.has(part.tag)) return collectTextContent(part);
    fail("html-text-child-unsupported", `Text elements may only contain text tags; found <${part.tag}> inside <${node.tag}>`);
    return "";
  }).join("");
}
