import { TEXT_CONTAINER_TAGS, TEXT_TAGS } from "../html/tags";
import { fail } from "../errors";
import type { Node, Style } from "../model";

const INLINE_TEXT_TAGS = new Set(["span", "strong", "b", "em", "i", "small", "br"]);

export function isTextNode(node: Node): boolean {
  return TEXT_TAGS.has(node.tag);
}

export function isTextContainer(node: Node): boolean {
  return TEXT_CONTAINER_TAGS.has(node.tag);
}

/** True when a node's content can be laid out as one inline text flow. */
export function isTextFlowNode(node: Node): boolean {
  return isTextContainer(node) || (node.content.length > 0 && node.content.every((part) => typeof part === "string" || INLINE_TEXT_TAGS.has(part.tag)));
}

export type CollectedTextContent = {
  text: string;
  /** UTF-16 offsets at which a <br> marker begins in text. */
  hardBreaks: number[];
};

export type TextStyleRun = {
  start: number;
  end: number;
  style: Style;
};

export type CollectedTextContentWithStyles = CollectedTextContent & {
  /** Style ranges point into `text` and are ordered/non-overlapping. */
  styleRuns: TextStyleRun[];
};

const TEXT_TRANSFORMS = new Set(["none", "uppercase", "lowercase", "capitalize"]);

/**
 * CSS `text-transform`, applied to the visible characters of one text run
 * before it reaches shaping/layout - matching a browser, which transforms
 * the rendered glyphs, not the underlying DOM text. `capitalize` uppercases
 * the first code point of each whitespace-delimited word; CSS's full
 * Unicode word-segmentation rules are not replicated here.
 */
function applyTextTransform(text: string, value: string | undefined): string {
  const transform = (value ?? "none").trim().toLowerCase();
  if (!TEXT_TRANSFORMS.has(transform)) fail("css-text-transform-unsupported", `Unsupported text-transform: ${transform}`);
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") return text.replace(/\S+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1));
  return text;
}

function sameStyle(left: Style, right: Style): boolean {
  if (left.size !== right.size) return false;
  for (const [property, value] of left) if (right.get(property) !== value) return false;
  return true;
}

function appendStyleRun(runs: TextStyleRun[], start: number, end: number, style: Style): void {
  if (end <= start) return;
  const previous = runs[runs.length - 1];
  if (previous && previous.end === start && sameStyle(previous.style, style)) {
    previous.end = end;
    return;
  }
  runs.push({ start, end, style });
}

/** Normalize source text while keeping hard-break offsets in the normalized string. */
export function normalizeTextContent(content: CollectedTextContent, trim = false): CollectedTextContent {
  let sourceCursor = 0;
  let text = "";
  const hardBreaks: number[] = [];
  for (const breakOffset of content.hardBreaks) {
    text += content.text.slice(sourceCursor, breakOffset).normalize("NFC");
    hardBreaks.push(text.length);
    if (content.text[breakOffset] === "\n") {
      text += "\n";
      sourceCursor = breakOffset + 1;
    } else {
      sourceCursor = breakOffset;
    }
  }
  text += content.text.slice(sourceCursor).normalize("NFC");
  if (!trim) return { text, hardBreaks };
  const leading = text.length - text.trimStart().length;
  const trimmed = text.trim();
  const end = leading + trimmed.length;
  return {
    text: trimmed,
    hardBreaks: hardBreaks
      .filter((breakOffset) => breakOffset >= leading && breakOffset < end)
      .map((breakOffset) => breakOffset - leading),
  };
}

export function collectTextContentWithBreaks(node: Node): CollectedTextContent {
  const result: CollectedTextContent = { text: "", hardBreaks: [] };
  for (const part of node.content) {
    if (typeof part === "string") {
      result.text += part;
      continue;
    }
    if (part.tag === "br") {
      result.hardBreaks.push(result.text.length);
      result.text += "\n";
      continue;
    }
    if (TEXT_TAGS.has(part.tag)) {
      const nested = collectTextContentWithBreaks(part);
      const offset = result.text.length;
      result.text += nested.text;
      result.hardBreaks.push(...nested.hardBreaks.map((breakOffset) => breakOffset + offset));
      continue;
    }
    fail("html-text-child-unsupported", `Text elements may only contain text tags; found <${part.tag}> inside <${node.tag}>`);
  }
  return result;
}

/**
 * Collect text and preserve the computed style of every inline element.
 * The old collector intentionally flattened nested tags; that is correct for
 * plain text extraction but loses the semantic runs needed by Protocol V2.
 */
export function collectTextContentWithStyles(node: Node, styles: ReadonlyMap<Node, Style>): CollectedTextContentWithStyles {
  const result: CollectedTextContentWithStyles = { text: "", hardBreaks: [], styleRuns: [] };
  const visit = (current: Node, inheritedStyle: Style): void => {
    const style = styles.get(current) ?? inheritedStyle;
    for (const part of current.content) {
      if (typeof part === "string") {
        const normalized = applyTextTransform(part.normalize("NFC"), style.get("text-transform"));
        const start = result.text.length;
        result.text += normalized;
        appendStyleRun(result.styleRuns, start, result.text.length, style);
        continue;
      }
      if (part.tag === "br") {
        result.hardBreaks.push(result.text.length);
        result.text += "\n";
        continue;
      }
      if (TEXT_TAGS.has(part.tag)) {
        visit(part, style);
        continue;
      }
      fail("html-text-child-unsupported", `Text elements may only contain text tags; found <${part.tag}> inside <${current.tag}>`);
    }
  };
  visit(node, styles.get(node) ?? new Map());
  return result;
}

/** Normalize/trims text while keeping inline style and hard-break offsets aligned. */
export function normalizeTextContentWithStyles(content: CollectedTextContentWithStyles, trim = false): CollectedTextContentWithStyles {
  const normalized: CollectedTextContentWithStyles = { text: content.text, hardBreaks: [...content.hardBreaks], styleRuns: content.styleRuns.map((run) => ({ ...run })) };
  if (!trim) return normalized;
  const leading = normalized.text.length - normalized.text.trimStart().length;
  const trimmed = normalized.text.trim();
  const end = leading + trimmed.length;
  normalized.text = trimmed;
  normalized.hardBreaks = normalized.hardBreaks
    .filter((breakOffset) => breakOffset >= leading && breakOffset < end)
    .map((breakOffset) => breakOffset - leading);
  normalized.styleRuns = normalized.styleRuns
    .map((run) => ({ start: Math.max(run.start, leading) - leading, end: Math.min(run.end, end) - leading, style: run.style }))
    .filter((run) => run.end > run.start);
  return normalized;
}

export function collectTextContent(node: Node): string {
  return collectTextContentWithBreaks(node).text;
}
