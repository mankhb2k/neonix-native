import type { HtmlCompilerSourceLocation } from "../source";

export const SUPPORTED_PROPERTIES = new Set(["position", "inset", "left", "right", "top", "bottom", "width", "height", "min-width", "max-width", "min-height", "max-height", "aspect-ratio", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "box-sizing", "background", "background-color", "color", "opacity", "font-size", "font-family", "font-weight", "font-style", "font-stretch", "line-height", "display", "visibility", "z-index", "overflow", "border", "border-width", "border-style", "border-color", "border-radius", "transform", "transform-origin", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linejoin", "stroke-linecap", "stroke-dasharray", "stroke-dashoffset", "paint-order", "object-fit", "object-position", "image-rendering"]);
export const SUPPORTED_TAGS = new Set(["html", "head", "meta", "div", "span", "p", "main", "section", "article", "header", "footer", "nav", "aside", "body", "img", "video", "svg", "g", "path"]);
export const INHERITED_PROPERTIES = new Set(["color", "font-size", "font-family", "font-weight", "font-style", "font-stretch", "line-height", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linejoin", "stroke-linecap", "stroke-dasharray", "stroke-dashoffset", "paint-order"]);
export const EXPLICIT_ID = /^[A-Za-z][A-Za-z0-9_-]{0,199}$/;
export const CLASS_TOKEN = /^-?(?:[A-Za-z_]|[A-Za-z_][A-Za-z0-9_-]*)[A-Za-z0-9_-]*$/;

export type Node = { tag: string; id?: string; atomicId: string; structuralPath: string; classes: string[]; attributes: Map<string, string>; children: Node[]; parent: Node | null; order: number; style: Map<string, string>; text: string };
export type Declaration = { property: string; value: string; important: boolean; order: number };
export type Rule = { selectors: string[]; declarations: Declaration[]; order: number };
export type Style = Map<string, string>;

export type SourceLocationFactory = (text: string, offset: number, kind: HtmlCompilerSourceLocation["kind"]) => HtmlCompilerSourceLocation;
