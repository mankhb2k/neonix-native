import type * as HarfBuzz from "harfbuzzjs";
import type { PaintFill, PaintTextDecoration, PaintTextGlyph } from "../paint/paint-types";
import { flattenPathContourAny, glyphPathToMesh, glyphPathToStrokeMesh, measureContour, sampleContourAtDistance, transformPathMesh } from "../geometry/path";
import type { GlyphRun, GlyphRunGlyph, VisualRuntimeDiagnostic, VisualRuntimeProject, VisualRuntimeTextLayout, VisualRuntimeText, VisualRuntimeTextSpan } from "./types";

export type VisualRuntimeTextFontSource = { assetId: string; uri: string; integrity: string };
export type VisualRuntimeTextFontResolver = (font: VisualRuntimeTextFontSource) => Promise<ArrayBuffer | Uint8Array | null>;
export type VisualRuntimeTextShaperLoader = () => Promise<typeof HarfBuzz>;
export type PrepareRuntimeTextResultV2 = { project: VisualRuntimeProject; diagnostics: VisualRuntimeDiagnostic[] };

export type TextLayoutMeasurement = {
  width: number;
  height: number;
  lineCount: number;
  lines: readonly { advance: number; baseline: number }[];
  ascender: number;
  descender: number;
  resolvedFontAssetIds: readonly string[];
};

type HbFace = InstanceType<typeof HarfBuzz.Face>;
type HbFont = InstanceType<typeof HarfBuzz.Font>;
type ResolvedFont = {
  source: VisualRuntimeTextFontSource;
  face: HbFace;
  font: HbFont;
  fontScale: number;
  metrics: ReturnType<HbFont["hExtents"]>;
  fontSize: number;
};
type UnmaterializedTextLayout = Omit<VisualRuntimeTextLayout, "glyphs"> & { runs: GlyphRun[] };
type LineGlyph = { glyph: GlyphRunGlyph; font: ResolvedFont; advanceStart: number };

function variationKey(text: VisualRuntimeText): string {
  return Object.entries(text.variations ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([tag, value]) => `${tag}=${value}`).join(",");
}

function configureFont(hb: typeof HarfBuzz, face: HbFace, text: VisualRuntimeText, span?: VisualRuntimeTextSpan): HbFont {
  const font = new hb.Font(face);
  const variations = Object.entries(span?.variations ?? text.variations ?? {}).map(([tag, value]) => new hb.Variation(tag, value));
  if (variations.length) font.setVariations(variations);
  return font;
}

function isVariationSelector(codePoint: number): boolean {
  return (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef);
}

function isDefaultIgnorable(codePoint: number): boolean {
  return codePoint === 0x200c || codePoint === 0x200d || isVariationSelector(codePoint);
}

type TextCluster = { start: number; end: number; text: string };

function segmentClusters(value: string): TextCluster[] {
  const Segmenter = (globalThis as { Intl?: { Segmenter?: new (locales?: string | string[], options?: { granularity?: string }) => { segment(input: string): Iterable<{ index: number; segment: string }> } } }).Intl?.Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: "grapheme" });
    const items = Array.from(segmenter.segment(value));
    return items.map((item, index) => ({ start: item.index, end: items[index + 1]?.index ?? value.length, text: item.segment }));
  }
  const result: TextCluster[] = [];
  let start = 0;
  for (const character of Array.from(value)) {
    const end = start + character.length;
    result.push({ start, end, text: value.slice(start, end) });
    start = end;
  }
  return result;
}

function fontSupportsCluster(font: HbFont, cluster: string): boolean {
  let hasRenderableCodePoint = false;
  for (const character of Array.from(cluster)) {
    const codePoint = character.codePointAt(0)!;
    if (isDefaultIgnorable(codePoint)) continue;
    hasRenderableCodePoint = true;
    if ((font.glyph(codePoint) ?? 0) === 0) return false;
  }
  return hasRenderableCodePoint;
}

function chooseFontIndex(fonts: ResolvedFont[], cluster: string): number {
  const index = fonts.findIndex((candidate) => fontSupportsCluster(candidate.font, cluster));
  return index >= 0 ? index : 0;
}

function fontRuns(fonts: ResolvedFont[], value: string): Array<{ start: number; end: number; fontIndex: number }> {
  const result: Array<{ start: number; end: number; fontIndex: number }> = [];
  for (const cluster of segmentClusters(value)) {
    const fontIndex = chooseFontIndex(fonts, cluster.text);
    const previous = result[result.length - 1];
    if (previous && previous.fontIndex === fontIndex && previous.end === cluster.start) previous.end = cluster.end;
    else result.push({ start: cluster.start, end: cluster.end, fontIndex });
  }
  return result;
}

type SourceLine = { text: string; start: number; isLastInParagraph: boolean };

type RuntimeWhiteSpace = NonNullable<VisualRuntimeText["whiteSpace"]>;

const HARD_BREAK_SENTINEL = "\uE000";

function normalizeWhiteSpace(value: string, mode: RuntimeWhiteSpace, hardBreaks: readonly number[] = []): string {
  const canonical = value.replace(/\r\n?/g, "\n");
  if (hardBreaks.length === 0) {
    if (mode === "pre" || mode === "pre-wrap" || mode === "break-spaces") return canonical;
    if (mode === "pre-line") return canonical.replace(/[ \t\f]+/g, " ").replace(/ *\n */g, "\n").replace(/^ +| +$/gm, "");
    return canonical.replace(/[ \t\n\f]+/g, " ").trim();
  }
  const breaks = new Set(hardBreaks);
  let protectedText = "";
  for (let index = 0; index < canonical.length; index += 1) {
    if (breaks.has(index)) {
      protectedText += HARD_BREAK_SENTINEL;
      if (canonical[index] === "\n") continue;
    }
    protectedText += canonical[index];
  }
  if (breaks.has(canonical.length)) protectedText += HARD_BREAK_SENTINEL;
  const normalized = mode === "pre" || mode === "pre-wrap" || mode === "break-spaces"
    ? protectedText
    : mode === "pre-line"
      ? protectedText.replace(/[ \t\f]+/g, " ").replace(/ *\n */g, "\n").replace(/^ +| +$/gm, "")
      : protectedText.replace(/[ \t\n\f]+/g, " ").trim();
  return normalized.replaceAll(HARD_BREAK_SENTINEL, "\n");
}

type TextStyleSlice = { start: number; end: number; span?: VisualRuntimeTextSpan };

function styleSlices(text: VisualRuntimeText, value: string, sourceOffset: number): TextStyleSlice[] {
  const spans = text.spanStyles ?? [];
  if (!spans.length) return [{ start: 0, end: value.length }];
  const sourceEnd = sourceOffset + value.length;
  const slices: TextStyleSlice[] = [];
  let cursor = 0;
  for (const span of spans) {
    const start = Math.max(sourceOffset, span.start);
    const end = Math.min(sourceEnd, span.end);
    if (end <= start) continue;
    const localStart = start - sourceOffset;
    const localEnd = end - sourceOffset;
    if (localStart > cursor) slices.push({ start: cursor, end: localStart });
    slices.push({ start: localStart, end: localEnd, span });
    cursor = localEnd;
  }
  if (cursor < value.length) slices.push({ start: cursor, end: value.length });
  return slices.length ? slices : [{ start: 0, end: value.length }];
}

function fontCandidates(fonts: ResolvedFont[], span?: VisualRuntimeTextSpan): ResolvedFont[] {
  if (!span?.fontAssetIds?.length) return fonts;
  const allowed = new Set(span.fontAssetIds);
  const selected = fonts.filter((font) => allowed.has(font.source.assetId));
  return selected.length ? selected : fonts;
}

function styledFonts(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[], span: VisualRuntimeTextSpan | undefined, cache: Map<string, ResolvedFont[]>): ResolvedFont[] {
  if (!span) return fonts;
  const key = `${span.fontAssetIds.join(",")}|${span.fontSize}|${span.fontWeight ?? ""}|${span.fontStyle ?? ""}|${span.fontStretch ?? ""}|${JSON.stringify(span.variations ?? {})}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const result = fontCandidates(fonts, span).map((base) => {
    const font = configureFont(hb, base.face, text, span);
    return { ...base, font, fontScale: span.fontSize / base.face.upem, metrics: font.hExtents(), fontSize: span.fontSize };
  });
  cache.set(key, result);
  return result;
}

/**
 * CSS font-variant: small-caps. Requesting the OpenType `smcp` feature is
 * a standards-compliant no-op when a font lacks true small-caps glyphs (the
 * text just shapes normally) rather than a synthetic faux-small-caps
 * fallback, which would need a second shaping pass per case-changed run -
 * out of scope here.
 */
export function shapeFeatures(hb: typeof HarfBuzz, text: VisualRuntimeText) {
  if (!text.smallCaps) return undefined;
  const feature = hb.Feature.fromString("smcp");
  return feature ? [feature] : undefined;
}

function measureSourceLine(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[], value: string, sourceOffset = 0): number {
  let advance = 0;
  const styleCache = new Map<string, ResolvedFont[]>();
  for (const slice of styleSlices(text, value, sourceOffset)) {
    const sliceText = value.slice(slice.start, slice.end);
    const sliceFonts = styledFonts(hb, text, fonts, slice.span, styleCache);
    for (const runRange of fontRuns(sliceFonts, sliceText)) {
      const resolved = sliceFonts[runRange.fontIndex]!;
      const buffer = new hb.Buffer();
      buffer.addText(sliceText.slice(runRange.start, runRange.end));
      buffer.setLanguage(text.language);
      buffer.setDirection(text.direction === "rtl" ? 5 : 4);
      buffer.guessSegmentProperties();
      hb.shape(resolved.font, buffer, shapeFeatures(hb, text));
      const positions = buffer.getGlyphPositions();
      advance += positions.reduce((total, position) => total + position.xAdvance * resolved.fontScale, 0);
    }
    const clusters = segmentClusters(sliceText);
    const letterSpacing = slice.span?.letterSpacing ?? text.letterSpacing;
    const wordSpacing = slice.span?.wordSpacing ?? text.wordSpacing ?? 0;
    advance += Math.max(0, clusters.length - 1) * letterSpacing;
    advance += clusters.filter((cluster) => /\s/.test(cluster.text)).length * wordSpacing;
  }
  return advance;
}

/** CSS word-break: break-all - wraps at any grapheme cluster boundary, ignoring word/space boundaries entirely. */
function wrapLineByClusters(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[], line: SourceLine, paragraphIndex: number, wrapWidthFor: (paragraphIndex: number, subLineIndex: number) => number): SourceLine[] {
  const clusters = segmentClusters(line.text);
  const wrapped: SourceLine[] = [];
  let current = "";
  let currentStart = line.start;
  for (const cluster of clusters) {
    const candidate = current + cluster.text;
    if (current && measureSourceLine(hb, text, fonts, candidate) > wrapWidthFor(paragraphIndex, wrapped.length)) {
      wrapped.push({ text: current, start: currentStart, isLastInParagraph: false });
      current = cluster.text;
      currentStart = line.start + cluster.start;
    } else {
      current = candidate;
    }
  }
  if (current) wrapped.push({ text: current, start: currentStart, isLastInParagraph: line.isLastInParagraph });
  return wrapped.length
    ? wrapped.map((wrappedLine, index) => ({ ...wrappedLine, isLastInParagraph: index === wrapped.length - 1 && line.isLastInParagraph }))
    : [line];
}

/** Breaks one overlong word at grapheme cluster boundaries so each chunk fits `width`; used only when the word alone doesn't fit an empty line. */
function breakLongWordByClusters(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[], word: string, wordStart: number, width: number): SourceLine[] {
  const clusters = segmentClusters(word);
  const chunks: SourceLine[] = [];
  let current = "";
  let currentStart = wordStart;
  for (const cluster of clusters) {
    const candidate = current + cluster.text;
    if (current && measureSourceLine(hb, text, fonts, candidate) > width) {
      chunks.push({ text: current, start: currentStart, isLastInParagraph: false });
      current = cluster.text;
      currentStart = wordStart + cluster.start;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push({ text: current, start: currentStart, isLastInParagraph: false });
  return chunks;
}

/**
 * CSS overflow-wrap/word-wrap: break-word - wraps at word boundaries like
 * normal word-wrap, but a single word that still doesn't fit alone on an
 * empty line gets broken at grapheme cluster boundaries instead of
 * overflowing. Only handles the white-space: normal case (not the
 * pre-wrap/break-spaces token-preserving path) - the common pairing in
 * practice, and the one CSS itself calls out as needing this fallback.
 */
function wrapLineByWordsBreakingLong(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[], line: SourceLine, paragraphIndex: number, wrapWidthFor: (paragraphIndex: number, subLineIndex: number) => number): SourceLine[] {
  const words = [...line.text.matchAll(/\S+(?:\s+|$)/g)];
  const wrapped: SourceLine[] = [];
  let current = "";
  let currentStart = line.start;
  for (const match of words) {
    const word = match[0]!.trim();
    if (!word) continue;
    const wordStart = line.start + (match.index ?? 0);
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureSourceLine(hb, text, fonts, candidate) > wrapWidthFor(paragraphIndex, wrapped.length)) {
      wrapped.push({ text: current, start: currentStart, isLastInParagraph: false });
      current = "";
      currentStart = wordStart;
    }
    const freshWidth = wrapWidthFor(paragraphIndex, wrapped.length);
    if (!current && measureSourceLine(hb, text, fonts, word) > freshWidth) {
      const chunks = breakLongWordByClusters(hb, text, fonts, word, wordStart, freshWidth);
      if (chunks.length > 1) {
        wrapped.push(...chunks.slice(0, -1));
        const last = chunks[chunks.length - 1]!;
        current = last.text;
        currentStart = last.start;
        continue;
      }
    }
    if (!current) currentStart = wordStart;
    current = current ? `${current} ${word}` : word;
  }
  if (current) wrapped.push({ text: current, start: currentStart, isLastInParagraph: line.isLastInParagraph });
  return wrapped.length
    ? wrapped.map((wrappedLine, index) => ({ ...wrappedLine, isLastInParagraph: index === wrapped.length - 1 && line.isLastInParagraph }))
    : [line];
}

function ellipsizeSourceLine(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[], line: SourceLine, contentWidth: number): SourceLine {
  const ellipsis = "…";
  if (measureSourceLine(hb, text, fonts, line.text, line.start) <= contentWidth) return line;
  if (measureSourceLine(hb, text, fonts, ellipsis, line.start) > contentWidth) return { ...line, text: "" };
  let prefix = "";
  for (const cluster of segmentClusters(line.text)) {
    const candidate = `${prefix}${cluster.text}${ellipsis}`;
    if (measureSourceLine(hb, text, fonts, candidate, line.start) > contentWidth) break;
    prefix += cluster.text;
  }
  return { ...line, text: `${prefix}${ellipsis}` };
}

function sourceLinesForText(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[]): SourceLine[] {
  const sourceText = normalizeWhiteSpace(text.text, text.whiteSpace ?? "normal", text.hardBreaks);
  const explicitLines: SourceLine[] = [];
  let start = 0;
  while (start <= sourceText.length) {
    const newline = sourceText.indexOf("\n", start);
    const end = newline < 0 ? sourceText.length : newline;
    explicitLines.push({ text: sourceText.slice(start, end), start, isLastInParagraph: newline < 0 });
    if (newline < 0) break;
    start = newline + 1;
  }
  const contentWidth = text.contentWidth ?? text.width;
  // CSS text-indent only offsets the very first line of the block - this
  // text layer is always exactly one block, so that's paragraph 0's first
  // wrapped sub-line, never a later hard-break paragraph's first line.
  const textIndent = text.textIndent ?? 0;
  const wrapWidthFor = (paragraphIndex: number, subLineIndex: number) => paragraphIndex === 0 && subLineIndex === 0 ? Math.max(0, contentWidth - textIndent) : contentWidth;
  const wrapsAtAll = text.wrap === "word" || text.wrap === "character" || text.wrap === "word-break-long";
  let lines = !wrapsAtAll || contentWidth <= 0 ? explicitLines : explicitLines.flatMap((line, paragraphIndex) => {
    if (!line.text.trim()) return [line];
    if (text.wrap === "character") return wrapLineByClusters(hb, text, fonts, line, paragraphIndex, wrapWidthFor);
    if (text.wrap === "word-break-long") return wrapLineByWordsBreakingLong(hb, text, fonts, line, paragraphIndex, wrapWidthFor);
    if (text.whiteSpace === "pre-wrap" || text.whiteSpace === "break-spaces") {
      const tokens = [...line.text.matchAll(/\S+|\s+/g)];
      const wrapped: SourceLine[] = [];
      let current = "";
      let currentStart = line.start;
      for (const match of tokens) {
        const token = match[0]!;
        const tokenStart = line.start + (match.index ?? 0);
        const candidate = current + token;
        if (current && measureSourceLine(hb, text, fonts, candidate) > wrapWidthFor(paragraphIndex, wrapped.length)) {
          wrapped.push({ text: current, start: currentStart, isLastInParagraph: false });
          current = token;
          currentStart = tokenStart;
        } else {
          if (!current) currentStart = tokenStart;
          current = candidate;
        }
      }
      if (current) wrapped.push({ text: current, start: currentStart, isLastInParagraph: line.isLastInParagraph });
      return wrapped.length
        ? wrapped.map((wrappedLine, index) => ({ ...wrappedLine, isLastInParagraph: index === wrapped.length - 1 && line.isLastInParagraph }))
        : [line];
    }
    const words = [...line.text.matchAll(/\S+(?:\s+|$)/g)];
    const wrapped: SourceLine[] = [];
    let current = "";
    let currentStart = line.start;
    for (const match of words) {
      const word = match[0]!.trim();
      if (!word) continue;
      const wordStart = line.start + (match.index ?? 0);
      const candidate = current ? `${current} ${word}` : word;
      if (current && measureSourceLine(hb, text, fonts, candidate) > wrapWidthFor(paragraphIndex, wrapped.length)) {
        wrapped.push({ text: current, start: currentStart, isLastInParagraph: false });
        current = word;
        currentStart = wordStart;
      } else {
        if (!current) currentStart = wordStart;
        current = candidate;
      }
    }
    if (current) wrapped.push({ text: current, start: currentStart, isLastInParagraph: line.isLastInParagraph });
    return wrapped.length
      ? wrapped.map((wrappedLine, index) => ({ ...wrappedLine, isLastInParagraph: index === wrapped.length - 1 && line.isLastInParagraph }))
      : [line];
  });
  if (text.textOverflow === "ellipsis" && text.overflow === "clip" && contentWidth > 0) {
    const maxLines = text.maxLines ?? 1;
    const truncated = lines.length > maxLines;
    lines = lines.slice(0, maxLines);
    if (lines.length && (truncated || measureSourceLine(hb, text, fonts, lines[lines.length - 1]!.text) > contentWidth)) {
      const last = lines.length - 1;
      lines[last] = ellipsizeSourceLine(hb, text, fonts, lines[last]!, contentWidth);
    }
  }
  return lines;
}

function justificationGaps(value: string): number {
  return (value.match(/\s+(?=\S)/g) ?? []).length;
}

function justificationGapsBefore(value: string, sourceIndex: number): number {
  return justificationGaps(value.slice(0, Math.max(0, sourceIndex)));
}

function colorToHex(color: { red: number; green: number; blue: number; alpha: number }): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}${channel(color.alpha)}`;
}

function standaloneSvgGlyphDocument(document: string, glyphId: number): string {
  const svgStart = document.indexOf("<svg");
  const rootEnd = svgStart >= 0 ? document.indexOf(">", svgStart) : -1;
  const defsStart = document.indexOf("<defs", rootEnd + 1);
  const defsEnd = defsStart >= 0 ? document.indexOf("</defs>", defsStart) : -1;
  const glyphStart = document.indexOf(`<g id="glyph${glyphId}">`, rootEnd + 1);
  const glyphClose = glyphStart >= 0 ? document.indexOf("</g>", glyphStart) : -1;
  if (svgStart < 0 || rootEnd < 0) return document;

  // OpenType SVG documents do not have to provide a browser viewport. In
  // particular, Noto Color Emoji stores glyphs in the font coordinate space
  // (roughly x=0..1200, y=-1000..200) and often omits width/height/viewBox.
  // Without a normalized viewBox the browser falls back to 300x150 and clips
  // the glyph before either the SVG reference or CanvasKit can render it.
  const root = document.slice(svgStart, rootEnd + 1)
    .replace(/\s(?:width|height|viewBox|preserveAspectRatio)=(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/<svg\b/i, '<svg width="1000" height="1000" viewBox="0 -1000 1200 1200"');
  const defs = defsStart >= 0 && defsEnd >= 0 ? document.slice(defsStart, defsEnd + "</defs>".length) : "";
  if (glyphStart < 0) return `${root}${defs}${document.slice(rootEnd + 1, document.lastIndexOf("</svg>"))}</svg>`;
  const glyph = document.slice(glyphStart, glyphClose >= 0 ? glyphClose + "</g>".length : document.length);
  return `${root}${defs}${glyph}${glyphClose >= 0 ? "" : "</g>"}</svg>`;
}

/** Read one SVG-in-OpenType document from the font's SVG table. */
function svgGlyphDocument(face: HbFace, glyphId: number): string | undefined {
  const table = face.referenceTable("SVG ");
  if (!table || table.length < 10) return undefined;
  const view = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const listOffset = view.getUint32(2, false);
  if (listOffset + 2 > table.length) return undefined;
  const count = view.getUint16(listOffset, false);
  for (let index = 0; index < count; index += 1) {
    const entry = listOffset + 2 + index * 12;
    if (entry + 12 > table.length) return undefined;
    const startGlyph = view.getUint16(entry, false);
    const endGlyph = view.getUint16(entry + 2, false);
    if (glyphId < startGlyph || glyphId > endGlyph) continue;
    const documentOffset = view.getUint32(entry + 4, false);
    const documentLength = view.getUint32(entry + 8, false);
    const absoluteOffset = listOffset + documentOffset;
    if (absoluteOffset + documentLength > table.length) return undefined;
    return standaloneSvgGlyphDocument(new TextDecoder().decode(table.slice(absoluteOffset, absoluteOffset + documentLength)), glyphId);
  }
  return undefined;
}

function shouldUseMask(text: VisualRuntimeText): boolean {
  const hasStrongRotation = text.rotate?.some((value) => Math.abs(value) > 0.01) ?? false;
  const horizontal = !text.writingMode || text.writingMode === "horizontal-tb";
  const maskEligible = horizontal && !text.textPath && !hasStrongRotation
    && !(text.textLength !== undefined && text.lengthAdjust === "spacingAndGlyphs")
    && !text.stroke && !text.textDecoration;
  if (text.textRendering === "geometricPrecision") return false;
  return maskEligible && (text.textRendering === "optimizeSpeed" || text.fontSize <= 48);
}

function layoutText(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[]): UnmaterializedTextLayout {
  const primary = fonts[0]!;
  const glyphHeight = (primary.metrics.ascender - primary.metrics.descender) * primary.fontScale;
  const sourceLines = sourceLinesForText(hb, text, fonts);
  const contentWidth = text.contentWidth ?? text.width;
  const contentHeight = text.contentHeight ?? text.height;
  const contentOffsetX = text.contentOffsetX ?? 0;
  const contentOffsetY = text.contentOffsetY ?? 0;
  const lineTop = contentOffsetY + (text.verticalAlign === "middle" ? (contentHeight - text.lineHeight * sourceLines.length) / 2 : text.verticalAlign === "bottom" ? contentHeight - text.lineHeight * sourceLines.length : 0);
  const lines: VisualRuntimeTextLayout["lines"] = [];
  const decorations: PaintTextDecoration[] = [];
  const runs: GlyphRun[] = [];
  const vertical = text.writingMode === "vertical-rl" || text.writingMode === "vertical-lr";
  const textPath = text.textPath?.contours[0] ? measureContour(flattenPathContourAny(text.textPath.contours[0])) : null;
  const styleCache = new Map<string, ResolvedFont[]>();

  for (const [lineIndex, sourceLine] of sourceLines.entries()) {
    const sourceOffset = sourceLine.start;
    const lineText = sourceLine.text;
    const lineGlyphs: LineGlyph[] = [];
    let penX = 0;
    let penY = 0;
    let runIndex = 0;
    for (const slice of styleSlices(text, lineText, sourceOffset)) {
      const sliceText = lineText.slice(slice.start, slice.end);
      const sliceFonts = styledFonts(hb, text, fonts, slice.span, styleCache);
      const letterSpacing = slice.span?.letterSpacing ?? text.letterSpacing;
      const wordSpacing = slice.span?.wordSpacing ?? text.wordSpacing ?? 0;
      for (const runRange of fontRuns(sliceFonts, sliceText)) {
      const resolved = sliceFonts[runRange.fontIndex]!;
      const runStart = slice.start + runRange.start;
      const runText = sliceText.slice(runRange.start, runRange.end);
      const buffer = new hb.Buffer();
      buffer.addText(runText);
      buffer.setLanguage(text.language);
      buffer.setDirection(text.direction === "rtl" && !vertical ? 5 : 4);
      buffer.guessSegmentProperties();
      hb.shape(resolved.font, buffer, shapeFeatures(hb, text));
      const infos = buffer.getGlyphInfos();
      const positions = buffer.getGlyphPositions();
      const clusterStarts = [...new Set(infos.map((info) => info.cluster))].sort((a, b) => a - b);
      const clusterEnds = new Map(clusterStarts.map((start, index) => [start, clusterStarts[index + 1] ?? runText.length]));
      const glyphRun: GlyphRun = {
        id: `text-line-${lineIndex}-run-${runIndex}`,
        fontAssetId: resolved.source.assetId,
        fontIntegrity: resolved.source.integrity,
        fontSize: resolved.fontSize,
        direction: vertical ? "ttb" : text.direction,
        language: text.language,
        glyphs: [],
      };
      for (let index = 0; index < infos.length; index += 1) {
        const info = infos[index]!;
        const position = positions[index]!;
        const extents = resolved.font.glyphExtents(info.codepoint);
        const sourceCharacter = runStart + info.cluster;
        if (extents && extents.width !== 0 && extents.height !== 0) {
          const cluster = sourceOffset + sourceCharacter;
          const clusterEnd = sourceOffset + runStart + (clusterEnds.get(info.cluster) ?? runText.length);
          const glyphX = vertical
            ? (text.writingMode === "vertical-rl" ? text.width - resolved.fontSize : 0) + (text.dx?.[sourceCharacter] ?? 0) + (position.xOffset + extents.xBearing) * resolved.fontScale
            : penX + (text.dx?.[sourceCharacter] ?? 0) + (position.xOffset + extents.xBearing) * resolved.fontScale;
          const glyphY = vertical
            ? penY + (text.dy?.[sourceCharacter] ?? 0) - (position.yOffset + extents.yBearing) * resolved.fontScale
            : -(position.yOffset + extents.yBearing) * resolved.fontScale;
          const glyph: GlyphRunGlyph = {
            glyphId: info.codepoint,
            cluster,
            clusterEnd,
            x: glyphX,
            y: glyphY,
            width: extents.width * resolved.fontScale,
            height: -extents.height * resolved.fontScale,
            xBearing: extents.xBearing,
            yBearing: extents.yBearing,
            advanceX: position.xAdvance * resolved.fontScale,
            advanceY: position.yAdvance * resolved.fontScale,
            fontAssetId: resolved.source.assetId,
            fontIntegrity: resolved.source.integrity,
            fontSize: resolved.fontSize,
            advanceStart: vertical ? penY : penX,
          };
          glyphRun.glyphs.push(glyph);
          lineGlyphs.push({ glyph, font: resolved, advanceStart: glyph.advanceStart });
        }
        if (vertical) penY += Math.abs(position.yAdvance * resolved.fontScale) || Math.abs(position.xAdvance * resolved.fontScale) || resolved.fontSize;
        else {
          penX += position.xAdvance * resolved.fontScale;
          if (index < infos.length - 1) penX += letterSpacing;
          if (/\s/.test(lineText[Math.max(0, Math.min(lineText.length - 1, sourceCharacter))] ?? "")) penX += wordSpacing;
        }
      }
      if (glyphRun.glyphs.length) runs.push(glyphRun);
      runIndex += 1;
      }
    }
    const naturalAdvance = vertical ? penY : penX;
    const gapCount = !vertical ? justificationGaps(lineText) : 0;
    const justifyLine = !vertical && text.textLength === undefined && gapCount > 0 && text.justify !== undefined
      && (text.justify === "all" || !sourceLine.isLastInParagraph);
    const targetAdvance = !vertical && text.textLength !== undefined
      ? text.textLength
      : justifyLine
        ? Math.max(naturalAdvance, contentWidth)
        : naturalAdvance;
    const extraPerGap = justifyLine ? Math.max(0, targetAdvance - naturalAdvance) / gapCount : 0;
    const lengthScale = naturalAdvance > 0 ? targetAdvance / naturalAdvance : 1;
    const lineTopBaseline = lineTop + lineIndex * text.lineHeight + (text.lineHeight - glyphHeight) / 2 + primary.metrics.ascender * primary.fontScale;
    const baselineY = text.dominantBaseline === "middle" || text.alignmentBaseline === "middle" ? lineTop + lineIndex * text.lineHeight + text.lineHeight / 2 - (primary.metrics.ascender + primary.metrics.descender) * primary.fontScale / 2 : lineTopBaseline;
    const adjustedBaselineY = baselineY + (text.baselineShift ?? 0);
    const alignedX = vertical ? 0 : contentOffsetX + (lineIndex === 0 ? (text.textIndent ?? 0) : 0) + (text.align === "center" ? (contentWidth - targetAdvance) / 2 : text.align === "right" ? contentWidth - targetAdvance : 0);
    for (const [glyphIndex, entry] of lineGlyphs.entries()) {
      const glyph = entry.glyph;
      if (!vertical) {
        const useGlyphScale = text.textLength !== undefined && text.lengthAdjust === "spacingAndGlyphs";
        const spacingShift = text.textLength !== undefined && !useGlyphScale && lineGlyphs.length > 1 ? (targetAdvance - naturalAdvance) * glyphIndex / (lineGlyphs.length - 1) : 0;
        const justifyShift = extraPerGap * justificationGapsBefore(lineText, glyph.cluster - sourceOffset);
        glyph.x = (useGlyphScale ? glyph.x * lengthScale : glyph.x) + alignedX + spacingShift + justifyShift;
        glyph.y += adjustedBaselineY;
        if (useGlyphScale) {
          glyph.width *= lengthScale;
          glyph.advanceX *= lengthScale;
          glyph.scaleX = (glyph.scaleX ?? 1) * lengthScale;
        }
        // `x` is the outline's left edge. The editor caret must use the
        // logical pen position, which also includes the glyph's side bearing.
        glyph.advanceStart = glyph.x - glyph.xBearing * entry.font.fontScale * (useGlyphScale ? lengthScale : 1);
        const characterIndex = Math.max(0, Math.min(lineText.length - 1, glyph.cluster - sourceOffset));
        const rotation = text.rotate?.[characterIndex] ?? 0;
        if (rotation) glyph.rotation = rotation;
      } else {
        // A vertical line occupies one line-height-wide column in the
        // inline content box. `vertical-rl` starts at the inline-end edge
        // and advances columns toward the left; `vertical-lr` starts at the
        // inline-start edge and advances toward the right.
        const columnX = text.writingMode === "vertical-rl"
          ? contentOffsetX + contentWidth - text.lineHeight * (lineIndex + 1)
          : contentOffsetX + text.lineHeight * lineIndex;
        const verticalOffset = lineTop + lineIndex * text.lineHeight + primary.metrics.ascender * primary.fontScale;
        glyph.x = columnX;
        glyph.y += verticalOffset;
        const characterIndex = Math.max(0, Math.min(lineText.length - 1, glyph.cluster - sourceOffset));
        glyph.rotation = (text.rotate?.[characterIndex] ?? 0) + 90;
      }
    }
    const finalAdvance = targetAdvance;
    if (!vertical && text.textPath && textPath) {
      const pathScale = text.textPath.method === "stretch" && naturalAdvance > 0 ? textPath.length / naturalAdvance : text.lengthAdjust === "spacingAndGlyphs" ? lengthScale : 1;
      for (const entry of lineGlyphs) {
        const glyph = entry.glyph;
        const progress = text.textLength !== undefined && text.lengthAdjust !== "spacingAndGlyphs" && lineGlyphs.length > 1 ? entry.advanceStart + (targetAdvance - naturalAdvance) * lineGlyphs.indexOf(entry) / (lineGlyphs.length - 1) : entry.advanceStart * pathScale;
        const sample = sampleContourAtDistance(textPath, text.textPath.startOffset + progress);
        const angle = Math.atan2(sample.tangent.y, sample.tangent.x);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const xBearing = glyph.xBearing * entry.font.fontScale;
        const yBearing = glyph.yBearing * entry.font.fontScale;
        // glyphPathToMesh positions glyph.x/y at the outline's top-left
        // anchor, while SVG textPath places the glyph baseline on the path.
        // Convert the baseline sample into that anchor before rotating.
        glyph.rotation = angle * 180 / Math.PI;
        glyph.x = sample.point.x + cos * xBearing + sin * yBearing;
        glyph.y = sample.point.y + sin * xBearing - cos * yBearing;
      }
    }
    if (!vertical && text.textDecoration) {
      const lineStartX = alignedX;
      const addDecoration = (style: { fill: string; fillPaint?: import("../paint/paint-types").PaintFill; thickness: number; opacity?: number } | undefined, y: number) => {
        if (!style || finalAdvance <= 0) return;
        decorations.push({ x: lineStartX, y, width: finalAdvance, height: style.thickness, fill: style.fill, ...(style.fillPaint ? { fillPaint: style.fillPaint } : {}), ...(style.opacity === undefined ? {} : { opacity: style.opacity }) });
      };
      addDecoration(text.textDecoration.underline, adjustedBaselineY + text.fontSize * 0.08);
      addDecoration(text.textDecoration.overline, adjustedBaselineY - text.fontSize * 0.82);
      addDecoration(text.textDecoration.lineThrough, adjustedBaselineY - text.fontSize * 0.32);
    }
    lines.push({ baselineY: vertical ? (text.writingMode === "vertical-rl" ? -text.fontSize * lineIndex : text.fontSize * lineIndex) : adjustedBaselineY, advanceWidth: finalAdvance });
  }
  return { unitsPerEm: primary.face.upem, ascender: primary.metrics.ascender, descender: primary.metrics.descender, runs, lines, ...(decorations.length ? { decorations } : {}) };
}

function materializeGlyphRuns(text: VisualRuntimeText, fonts: ResolvedFont[], layout: UnmaterializedTextLayout): VisualRuntimeTextLayout {
  const fontsById = new Map(fonts.map((font) => [font.source.assetId, font]));
  const useMask = shouldUseMask(text);
  const fills: Array<{ start: number; end: number; fill: string; fillPaint?: PaintFill }> = text.spanPaints ?? text.spanFills ?? [];
  const variation = variationKey(text);
  const glyphs: PaintTextGlyph[] = [];
  for (const run of layout.runs) {
    const resolved = fontsById.get(run.fontAssetId);
    if (!resolved) continue;
    for (const glyph of run.glyphs) {
      const path = resolved.font.glyphToPath(glyph.glyphId);
      const spanPaint = fills.find((span) => glyph.cluster < span.end && glyph.clusterEnd > span.start);
      const fill = spanPaint?.fill;
      const glyphScale = glyph.fontSize / resolved.face.upem;
      const outline = { x: glyph.xBearing, y: glyph.yBearing, width: glyph.width / glyphScale, height: -glyph.height / glyphScale };
      const renderMode = useMask ? "grayscale-mask" as const : "vector" as const;
      const paintGlyph: PaintTextGlyph = {
        glyphId: glyph.glyphId, cluster: glyph.cluster, clusterEnd: glyph.clusterEnd, ...(fill ? { fill } : {}), ...(spanPaint?.fillPaint ? { fillPaint: spanPaint.fillPaint } : {}),
        x: glyph.x, y: glyph.y, width: glyph.width, height: glyph.height,
        advanceStart: glyph.advanceStart,
        advanceX: glyph.advanceX,
        advanceY: glyph.advanceY,
        path, pathScale: glyphScale, outline,
        fontAssetId: glyph.fontAssetId, fontIntegrity: glyph.fontIntegrity, renderMode,
        fontSize: glyph.fontSize,
        ...(variation ? { variationKey: variation } : {}), ...(glyph.rotation ? { rotation: glyph.rotation } : {}), ...(glyph.scaleX ? { scaleX: glyph.scaleX } : {}),
      };
      if (renderMode === "vector") {
        paintGlyph.mesh = glyphPathToMesh(path, glyphScale, outline, glyph.x, glyph.y) ?? undefined;
        if (paintGlyph.mesh && glyph.scaleX && glyph.scaleX !== 1) {
          paintGlyph.mesh = transformPathMesh(paintGlyph.mesh, { scaleX: glyph.scaleX, originX: glyph.x, originY: glyph.y });
        }
        if (text.stroke && text.strokeWidth) {
          paintGlyph.stroke = text.stroke; paintGlyph.strokePaint = text.strokePaint; paintGlyph.strokeWidth = text.strokeWidth; paintGlyph.strokeOpacity = text.strokeOpacity;
          paintGlyph.strokeMesh = glyphPathToStrokeMesh(path, glyphScale, outline, glyph.x, glyph.y, text.strokeWidth) ?? undefined;
          if (paintGlyph.strokeMesh && glyph.scaleX && glyph.scaleX !== 1) {
            paintGlyph.strokeMesh = transformPathMesh(paintGlyph.strokeMesh, { scaleX: glyph.scaleX, originX: glyph.x, originY: glyph.y });
          }
        }
        if (glyph.rotation) {
          paintGlyph.mesh = paintGlyph.mesh ? transformPathMesh(paintGlyph.mesh, { rotation: glyph.rotation, originX: glyph.x, originY: glyph.y }) : undefined;
          paintGlyph.strokeMesh = paintGlyph.strokeMesh ? transformPathMesh(paintGlyph.strokeMesh, { rotation: glyph.rotation, originX: glyph.x, originY: glyph.y }) : undefined;
        }
      }
      // Keep the native COLRv1 paint graph as the primary source. The SVG
      // document is retained only as a backend fallback: rasterizing it into
      // an image before Skia gets the glyph loses the font's native color
      // rasterization quality and makes small emoji look softer than SVG text.
      const svgDocument = svgGlyphDocument(resolved.face, glyph.glyphId);
      const svgFallback = svgDocument
        ? { kind: "bitmap" as const, mimeType: "image/svg+xml" as const, bytes: new TextEncoder().encode(svgDocument) }
        : undefined;
      const hasColorPaint = resolved.face.hasColorPaint() && resolved.face.glyphHasColorPaint(glyph.glyphId);
      if (hasColorPaint) {
        paintGlyph.renderMode = "color-paint";
        paintGlyph.colorGlyph = { kind: "paint-graph" };
        if (svgFallback) paintGlyph.colorGlyphFallback = svgFallback;
      } else if (resolved.face.hasColorLayers()) {
        const layers = resolved.face.getGlyphColorLayers(glyph.glyphId);
        if (layers.length) {
          const palette = resolved.face.getColorPalettes()[0]?.colors ?? [];
          paintGlyph.renderMode = "color-layers";
          paintGlyph.colorGlyph = { kind: "layers", layers: layers.flatMap((layer) => {
            const extents = resolved.font.glyphExtents(layer.glyph);
            const layerPath = resolved.font.glyphToPath(layer.glyph);
            if (!extents || !layerPath) return [];
            const layerOutline = { x: extents.xBearing, y: extents.yBearing, width: extents.width, height: extents.height };
            const layerX = glyph.x + (glyph.xBearing - extents.xBearing) * glyphScale;
            const layerY = glyph.y + (glyph.yBearing - extents.yBearing) * glyphScale;
            let mesh = glyphPathToMesh(layerPath, glyphScale, layerOutline, layerX, layerY) ?? undefined;
            if (mesh && glyph.rotation) mesh = transformPathMesh(mesh, { rotation: glyph.rotation, originX: glyph.x, originY: glyph.y });
            return [{ fill: layer.colorIndex === undefined ? (fill ?? "#000000ff") : colorToHex(palette[layer.colorIndex] ?? { red: 0, green: 0, blue: 0, alpha: 255 }), path: layerPath, pathScale: glyphScale, outline: { x: layerOutline.x, y: layerOutline.y }, x: layerX, y: layerY, mesh }];
          }) };
        }
      }
      if (resolved.face.hasColorPng()) {
        const png = resolved.font.getGlyphColorPng(glyph.glyphId);
        if (png?.length && !paintGlyph.colorGlyph) { paintGlyph.renderMode = "color-bitmap"; paintGlyph.colorGlyph = { kind: "bitmap", mimeType: "image/png", bytes: png }; }
      }
      if (!paintGlyph.colorGlyph && svgFallback) {
        paintGlyph.renderMode = "color-svg";
        paintGlyph.colorGlyph = svgFallback;
      }
      glyphs.push(paintGlyph);
    }
  }
  return { ...layout, glyphs };
}

function fontSourcesForText(text: VisualRuntimeText): VisualRuntimeTextFontSource[] {
  const primary = { assetId: text.fontAssetId, uri: text.fontUri, integrity: text.fontIntegrity };
  const sources = [primary, ...(text.fontFallbacks ?? [])];
  return sources.filter((source, index) => sources.findIndex((candidate) => candidate.assetId === source.assetId) === index);
}

/** Measure text with the same HarfBuzz shaping path used by Preview. */
export async function measureVisualRuntimeText(
  text: VisualRuntimeText,
  resolveFont: VisualRuntimeTextFontResolver,
  loadHarfBuzz: VisualRuntimeTextShaperLoader,
): Promise<TextLayoutMeasurement | null> {
  const hb = await loadHarfBuzz();
  const resolvedFonts: ResolvedFont[] = [];
  for (const source of fontSourcesForText(text)) {
    const bytes = await resolveFont(source);
    if (!bytes) continue;
    const blob = new hb.Blob(bytes);
    const face = new hb.Face(blob);
    const font = configureFont(hb, face, text);
    resolvedFonts.push({
      source,
      face,
      font,
      fontScale: text.fontSize / face.upem,
      metrics: font.hExtents(),
      fontSize: text.fontSize,
    });
  }
  if (!resolvedFonts.length) return null;
  const layout = layoutText(hb, text, resolvedFonts);
  const lines = layout.lines.map((line) => ({
    advance: line.advanceWidth,
    baseline: line.baselineY,
  }));
  const vertical = text.writingMode === "vertical-rl" || text.writingMode === "vertical-lr";
  const width = vertical
    ? Math.max(1, text.lineHeight * Math.max(1, lines.length))
    : Math.max(1, ...lines.map((line) => line.advance));
  const height = vertical
    ? Math.max(1, ...lines.map((line) => line.advance))
    : Math.max(1, text.lineHeight * Math.max(1, lines.length));
  const primary = resolvedFonts[0]!;
  return {
    width,
    height,
    lineCount: Math.max(1, lines.length),
    lines,
    ascender: primary.metrics.ascender * primary.fontScale,
    descender: primary.metrics.descender * primary.fontScale,
    resolvedFontAssetIds: resolvedFonts.map((font) => font.source.assetId),
  };
}

export type TextIntrinsicWidths = {
  /** The narrowest a `width:auto` box can shrink to without a single word overflowing it - CSS's min-content inline size. Equals maxContent when the text can't wrap (`wrap !== "word"`). */
  minContent: number;
  /** The text's width laid out on one line per explicit break, with no wrapping at all - CSS's max-content inline size. */
  maxContent: number;
};

/**
 * Computes CSS's min-content/max-content inline sizes for a text run, using
 * the exact same real HarfBuzz shaping + greedy word-wrap `sourceLinesForText`
 * already uses for actual layout - not a separate heuristic. Chromium's own
 * `LineBreaker` computes these the same way: max-content is one unwrapped
 * line (an unreachably wide `contentWidth`), min-content is the same wrap
 * loop breaking at every possible opportunity (the smallest positive
 * `contentWidth`, since `sourceLinesForText` treats an exact `<= 0` width as
 * "wrapping disabled" rather than "wrap after every word").
 *
 * Ellipsis/overflow truncation is intentionally excluded from both probes:
 * `text-overflow` is a paint-time truncation of already-wrapped content, not
 * a contributor to the box's own intrinsic size (matching how a real browser
 * separates intrinsic sizing from overflow handling).
 */
export async function measureVisualRuntimeTextIntrinsicWidths(
  text: VisualRuntimeText,
  resolveFont: VisualRuntimeTextFontResolver,
  loadHarfBuzz: VisualRuntimeTextShaperLoader,
): Promise<TextIntrinsicWidths | null> {
  const hb = await loadHarfBuzz();
  const resolvedFonts: ResolvedFont[] = [];
  for (const source of fontSourcesForText(text)) {
    const bytes = await resolveFont(source);
    if (!bytes) continue;
    const blob = new hb.Blob(bytes);
    const face = new hb.Face(blob);
    const font = configureFont(hb, face, text);
    resolvedFonts.push({ source, face, font, fontScale: text.fontSize / face.upem, metrics: font.hExtents(), fontSize: text.fontSize });
  }
  if (!resolvedFonts.length) return null;

  const widthAtContentWidth = (contentWidth: number): number => {
    const probe: VisualRuntimeText = { ...text, contentWidth, width: contentWidth, textOverflow: undefined };
    const lines = sourceLinesForText(hb, probe, resolvedFonts);
    return Math.max(1, ...lines.map((line) => measureSourceLine(hb, text, resolvedFonts, line.text, line.start)));
  };

  const maxContent = widthAtContentWidth(Number.POSITIVE_INFINITY);
  const minContent = (text.wrap === "word" || text.wrap === "character" || text.wrap === "word-break-long") ? widthAtContentWidth(Number.MIN_VALUE) : maxContent;
  return { minContent, maxContent };
}

export async function prepareVisualRuntimeProjectText(project: VisualRuntimeProject, resolveFont: VisualRuntimeTextFontResolver, loadHarfBuzz: VisualRuntimeTextShaperLoader): Promise<PrepareRuntimeTextResultV2> {
  const diagnostics: VisualRuntimeDiagnostic[] = [];
  const textNodes = project.nodes.filter((node) => node.content.kind === "text");
  if (!textNodes.length) return { project, diagnostics };
  let hb: typeof HarfBuzz;
  try { hb = await loadHarfBuzz(); }
  catch (error) {
    return { project, diagnostics: textNodes.map((node) => ({ severity: "error" as const, code: "runtime_v2_text_shaper_unavailable", message: `Text shaper failed to load for ${node.id}: ${error instanceof Error ? error.message : String(error)}`, nodeId: node.id })) };
  }
  const nodes = await Promise.all(project.nodes.map(async (node) => {
    if (node.content.kind !== "text") return node;
    try {
      const resolvedFonts: ResolvedFont[] = [];
      for (const source of fontSourcesForText(node.content)) {
        const bytes = await resolveFont(source);
        if (!bytes) { diagnostics.push({ severity: "warning", code: "runtime_v2_font_fallback_unavailable", message: `Font asset ${source.assetId} is unavailable for text layer ${node.id}`, nodeId: node.id }); continue; }
        const blob = new hb.Blob(bytes);
        const face = new hb.Face(blob);
        const font = configureFont(hb, face, node.content);
        resolvedFonts.push({ source, face, font, fontScale: node.content.fontSize / face.upem, metrics: font.hExtents(), fontSize: node.content.fontSize });
      }
      if (!resolvedFonts.length) { diagnostics.push({ severity: "error", code: "runtime_v2_font_unavailable", message: `No font asset is available for text layer ${node.id}`, nodeId: node.id }); return node; }
      const layout = layoutText(hb, node.content, resolvedFonts);
      return { ...node, content: { ...node.content, layout: materializeGlyphRuns(node.content, resolvedFonts, layout) } };
    } catch (error) {
      diagnostics.push({ severity: "error", code: "runtime_v2_text_layout_failed", message: `Text layout failed for ${node.id}: ${error instanceof Error ? error.message : String(error)}`, nodeId: node.id });
      return node;
    }
  }));
  return { project: { ...project, nodes }, diagnostics };
}
