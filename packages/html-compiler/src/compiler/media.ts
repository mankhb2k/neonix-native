import { fail } from "./errors";
import type { Node, Style } from "./model";

export type HtmlImageFit = "contain" | "cover" | "fill" | "none";
export type HtmlImageAlign = "none" | "xMinYMin" | "xMidYMin" | "xMaxYMin" | "xMinYMid" | "xMidYMid" | "xMaxYMid" | "xMinYMax" | "xMidYMax" | "xMaxYMax";
export type HtmlImageRendering = "auto" | "optimizeQuality" | "optimizeSpeed" | "smooth" | "high-quality" | "crisp-edges" | "pixelated";

function axis(value: string, horizontal: boolean): 0 | 0.5 | 1 | undefined {
  const normalized = value.toLowerCase();
  if (horizontal && normalized === "left") return 0;
  if (horizontal && normalized === "right") return 1;
  if (!horizontal && normalized === "top") return 0;
  if (!horizontal && normalized === "bottom") return 1;
  if (normalized === "center") return 0.5;
  const percent = normalized.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (!percent) return undefined;
  const number = Number(percent[1]);
  if (number === 0) return 0;
  if (number === 50) return 0.5;
  if (number === 100) return 1;
  return undefined;
}

export function parseImageFit(style: Style): HtmlImageFit {
  const value = (style.get("object-fit") ?? "fill").trim().toLowerCase();
  if (!["contain", "cover", "fill", "none"].includes(value)) fail("css-object-fit-invalid", `object-fit supports contain, cover, fill or none: ${value}`);
  return value as HtmlImageFit;
}

export function parseObjectPosition(style: Style): HtmlImageAlign {
  const raw = (style.get("object-position") ?? "50% 50%").trim().toLowerCase();
  const values = raw.split(/\s+/).filter(Boolean);
  if (values.length === 1) {
    if (values[0] === "center") return "xMidYMid";
    const horizontal = axis(values[0]!, true);
    const vertical = axis(values[0]!, false);
    if (horizontal !== undefined && vertical === undefined) return horizontal === 0 ? "xMinYMid" : horizontal === 1 ? "xMaxYMid" : "xMidYMid";
    if (vertical !== undefined && horizontal === undefined) return vertical === 0 ? "xMidYMin" : vertical === 1 ? "xMidYMax" : "xMidYMid";
  }
  if (values.length === 2) {
    let horizontal = axis(values[0]!, true);
    let vertical = axis(values[1]!, false);
    if (horizontal === undefined && axis(values[0]!, false) !== undefined && axis(values[1]!, true) !== undefined) {
      vertical = axis(values[0]!, false);
      horizontal = axis(values[1]!, true);
    }
    if (horizontal !== undefined && vertical !== undefined) {
      const x = horizontal === 0 ? "xMin" : horizontal === 1 ? "xMax" : "xMid";
      const y = vertical === 0 ? "YMin" : vertical === 1 ? "YMax" : "YMid";
      return `${x}${y}` as HtmlImageAlign;
    }
  }
  fail("css-object-position-unsupported", `object-position supports keyword or 0%, 50%, 100% pairs: ${raw}`);
  return "xMidYMid";
}

export function parseImageRendering(style: Style): HtmlImageRendering | undefined {
  const value = style.get("image-rendering")?.trim().toLowerCase();
  if (value === undefined) return undefined;
  if (!["auto", "optimizequality", "optimizespeed", "smooth", "high-quality", "crisp-edges", "pixelated"].includes(value)) fail("css-image-rendering-invalid", `Unsupported image-rendering value: ${value}`);
  if (value === "optimizequality") return "optimizeQuality";
  if (value === "optimizespeed") return "optimizeSpeed";
  return value as HtmlImageRendering;
}

export function mediaSource(node: Node): string {
  const source = node.attributes.get("src")?.trim();
  if (!source) fail("html-media-src-missing", `<${node.tag}> requires a non-empty src attribute`);
  return source!;
}

export function mediaMimeType(source: string, kind: "image" | "video" | "audio"): string {
  const extension = source.split(/[?#]/, 1)[0]!.split(".").at(-1)?.toLowerCase();
  if (kind === "video") {
    if (extension === "webm") return "video/webm";
    if (extension === "mov") return "video/quicktime";
    return "video/mp4";
  }
  if (kind === "audio") {
    if (extension === "wav") return "audio/wav";
    if (extension === "ogg" || extension === "oga") return "audio/ogg";
    if (extension === "m4a" || extension === "aac") return "audio/mp4";
    return "audio/mpeg";
  }
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}
