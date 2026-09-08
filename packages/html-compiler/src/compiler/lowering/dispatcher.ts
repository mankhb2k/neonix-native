import { isTextNode } from "./text";
import type { Node } from "../model";

export { collectTextContent, collectTextContentWithBreaks, collectTextContentWithStyles, isTextContainer, isTextFlowNode, isTextNode, normalizeTextContent, normalizeTextContentWithStyles } from "./text";

export type LoweringKind = "audio" | "image" | "video" | "text" | "svg" | "container";

export function classifyNode(node: Node): LoweringKind {
  if (node.tag === "audio") return "audio";
  if (node.tag === "img") return "image";
  if (node.tag === "video") return "video";
  if (isTextNode(node)) return "text";
  if (["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"].includes(node.tag)) return "svg";
  return "container";
}

export function isSvgNode(node: Node): boolean {
  return classifyNode(node) === "svg";
}
