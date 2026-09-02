import type * as HarfBuzz from "harfbuzzjs";
import type { PaintTextDecoration, PaintTextGlyph } from "../paint/paint-types";
import { flattenPathContourAny, glyphPathToMesh, glyphPathToStrokeMesh, measureContour, sampleContourAtDistance, transformPathMesh } from "../geometry/path";
import type { GlyphRun, GlyphRunGlyph, VisualRuntimeDiagnostic, VisualRuntimeProject, VisualRuntimeTextLayout, VisualRuntimeText } from "./types";

export type VisualRuntimeTextFontSource = { assetId: string; uri: string; integrity: string };
export type VisualRuntimeTextFontResolver = (font: VisualRuntimeTextFontSource) => Promise<ArrayBuffer | Uint8Array | null>;
export type VisualRuntimeTextShaperLoader = () => Promise<typeof HarfBuzz>;
export type PrepareRuntimeTextResultV2 = { project: VisualRuntimeProject; diagnostics: VisualRuntimeDiagnostic[] };

type HbFace = InstanceType<typeof HarfBuzz.Face>;
type HbFont = InstanceType<typeof HarfBuzz.Font>;
type ResolvedFont = {
  source: VisualRuntimeTextFontSource;
  face: HbFace;
  font: HbFont;
  fontScale: number;
  metrics: ReturnType<HbFont["hExtents"]>;
};
type UnmaterializedTextLayout = Omit<VisualRuntimeTextLayout, "glyphs"> & { runs: GlyphRun[] };
type LineGlyph = { glyph: GlyphRunGlyph; font: ResolvedFont; advanceStart: number };

function variationKey(text: VisualRuntimeText): string {
  return Object.entries(text.variations ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([tag, value]) => `${tag}=${value}`).join(",");
}

function configureFont(hb: typeof HarfBuzz, face: HbFace, text: VisualRuntimeText): HbFont {
  const font = new hb.Font(face);
  const variations = Object.entries(text.variations ?? {}).map(([tag, value]) => new hb.Variation(tag, value));
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

function colorToHex(color: { red: number; green: number; blue: number; alpha: number }): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}${channel(color.alpha)}`;
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
    if (documentOffset + documentLength > table.length) return undefined;
    return new TextDecoder().decode(table.slice(documentOffset, documentOffset + documentLength));
  }
  return undefined;
}

function shouldUseMask(text: VisualRuntimeText): boolean {
  const hasStrongRotation = text.rotate?.some((value) => Math.abs(value) > 0.01) ?? false;
  const horizontal = !text.writingMode || text.writingMode === "horizontal-tb";
  return text.fontSize <= 48 && horizontal && !text.textPath && !hasStrongRotation
    && !(text.textLength !== undefined && text.lengthAdjust === "spacingAndGlyphs")
    && !text.stroke && !text.textDecoration;
}

function layoutText(hb: typeof HarfBuzz, text: VisualRuntimeText, fonts: ResolvedFont[]): UnmaterializedTextLayout {
  const primary = fonts[0]!;
  const glyphHeight = (primary.metrics.ascender - primary.metrics.descender) * primary.fontScale;
  const sourceLines = text.text.split("\n");
  const lineTop = text.verticalAlign === "middle" ? (text.height - text.lineHeight * sourceLines.length) / 2 : text.verticalAlign === "bottom" ? text.height - text.lineHeight * sourceLines.length : 0;
  const lines: VisualRuntimeTextLayout["lines"] = [];
  const decorations: PaintTextDecoration[] = [];
  const runs: GlyphRun[] = [];
  let sourceOffset = 0;
  const vertical = text.writingMode === "vertical-rl" || text.writingMode === "vertical-lr";
  const textPath = text.textPath?.contours[0] ? measureContour(flattenPathContourAny(text.textPath.contours[0])) : null;

  for (const [lineIndex, sourceLine] of sourceLines.entries()) {
    const lineGlyphs: LineGlyph[] = [];
    let penX = 0;
    let penY = 0;
    for (const [runIndex, runRange] of fontRuns(fonts, sourceLine).entries()) {
      const resolved = fonts[runRange.fontIndex]!;
      const runText = sourceLine.slice(runRange.start, runRange.end);
      const buffer = new hb.Buffer();
      buffer.addText(runText);
      buffer.setLanguage(text.language);
      buffer.setDirection(text.direction === "rtl" && !vertical ? 5 : 4);
      buffer.guessSegmentProperties();
      hb.shape(resolved.font, buffer);
      const infos = buffer.getGlyphInfos();
      const positions = buffer.getGlyphPositions();
      const clusterStarts = [...new Set(infos.map((info) => info.cluster))].sort((a, b) => a - b);
      const clusterEnds = new Map(clusterStarts.map((start, index) => [start, clusterStarts[index + 1] ?? runText.length]));
      const glyphRun: GlyphRun = {
        id: `text-line-${lineIndex}-run-${runIndex}`,
        fontAssetId: resolved.source.assetId,
        fontIntegrity: resolved.source.integrity,
        fontSize: text.fontSize,
        direction: vertical ? "ttb" : text.direction,
        language: text.language,
        glyphs: [],
      };
      for (let index = 0; index < infos.length; index += 1) {
        const info = infos[index]!;
        const position = positions[index]!;
        const extents = resolved.font.glyphExtents(info.codepoint);
        const sourceCharacter = runRange.start + info.cluster;
        if (extents && extents.width !== 0 && extents.height !== 0) {
          const cluster = sourceOffset + sourceCharacter;
          const clusterEnd = sourceOffset + runRange.start + (clusterEnds.get(info.cluster) ?? runText.length);
          const glyphX = vertical
            ? (text.writingMode === "vertical-rl" ? text.width - text.fontSize : 0) + (text.dx?.[sourceCharacter] ?? 0) + (position.xOffset + extents.xBearing) * resolved.fontScale
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
            advanceStart: vertical ? penY : penX,
          };
          glyphRun.glyphs.push(glyph);
          lineGlyphs.push({ glyph, font: resolved, advanceStart: glyph.advanceStart });
        }
        if (vertical) penY += Math.abs(position.yAdvance * resolved.fontScale) || Math.abs(position.xAdvance * resolved.fontScale) || text.fontSize;
        else {
          penX += position.xAdvance * resolved.fontScale;
          if (index < infos.length - 1) penX += text.letterSpacing;
          if (/\s/.test(sourceLine[Math.max(0, Math.min(sourceLine.length - 1, sourceCharacter))] ?? "")) penX += text.wordSpacing ?? 0;
        }
      }
      if (glyphRun.glyphs.length) runs.push(glyphRun);
    }
    const naturalAdvance = vertical ? penY : penX;
    const targetAdvance = !vertical && text.textLength !== undefined ? text.textLength : naturalAdvance;
    const lengthScale = naturalAdvance > 0 ? targetAdvance / naturalAdvance : 1;
    const lineTopBaseline = lineTop + lineIndex * text.lineHeight + (text.lineHeight - glyphHeight) / 2 + primary.metrics.ascender * primary.fontScale;
    const baselineY = text.dominantBaseline === "middle" || text.alignmentBaseline === "middle" ? lineTop + lineIndex * text.lineHeight + text.lineHeight / 2 - (primary.metrics.ascender + primary.metrics.descender) * primary.fontScale / 2 : lineTopBaseline;
    const adjustedBaselineY = baselineY + (text.baselineShift ?? 0);
    const alignedX = vertical ? 0 : text.align === "center" ? (text.width - targetAdvance) / 2 : text.align === "right" ? text.width - targetAdvance : 0;
    for (const [glyphIndex, entry] of lineGlyphs.entries()) {
      const glyph = entry.glyph;
      if (!vertical) {
        const useGlyphScale = text.textLength !== undefined && text.lengthAdjust === "spacingAndGlyphs";
        const spacingShift = text.textLength !== undefined && !useGlyphScale && lineGlyphs.length > 1 ? (targetAdvance - naturalAdvance) * glyphIndex / (lineGlyphs.length - 1) : 0;
        glyph.x = (useGlyphScale ? glyph.x * lengthScale : glyph.x) + alignedX + spacingShift;
        glyph.y += adjustedBaselineY;
        if (useGlyphScale) { glyph.width *= lengthScale; glyph.scaleX = (glyph.scaleX ?? 1) * lengthScale; }
        const characterIndex = Math.max(0, Math.min(sourceLine.length - 1, glyph.cluster - sourceOffset));
        const rotation = text.rotate?.[characterIndex] ?? 0;
        if (rotation) glyph.rotation = rotation;
      } else {
        const columnX = text.writingMode === "vertical-rl" ? -text.fontSize * lineIndex : text.fontSize * lineIndex;
        const verticalOffset = lineTop + lineIndex * text.lineHeight + primary.metrics.ascender * primary.fontScale;
        glyph.x = columnX;
        glyph.y += verticalOffset;
        const characterIndex = Math.max(0, Math.min(sourceLine.length - 1, glyph.cluster - sourceOffset));
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
    sourceOffset += sourceLine.length + 1;
  }
  return { unitsPerEm: primary.face.upem, ascender: primary.metrics.ascender, descender: primary.metrics.descender, runs, lines, ...(decorations.length ? { decorations } : {}) };
}

function materializeGlyphRuns(text: VisualRuntimeText, fonts: ResolvedFont[], layout: UnmaterializedTextLayout): VisualRuntimeTextLayout {
  const fontsById = new Map(fonts.map((font) => [font.source.assetId, font]));
  const useMask = shouldUseMask(text);
  const fills = text.spanFills ?? [];
  const variation = variationKey(text);
  const glyphs: PaintTextGlyph[] = [];
  for (const run of layout.runs) {
    const resolved = fontsById.get(run.fontAssetId);
    if (!resolved) continue;
    for (const glyph of run.glyphs) {
      const path = resolved.font.glyphToPath(glyph.glyphId);
      const fill = fills.find((span) => glyph.cluster < span.end && glyph.clusterEnd > span.start)?.fill;
      const outline = { x: glyph.xBearing, y: glyph.yBearing, width: glyph.width / resolved.fontScale, height: -glyph.height / resolved.fontScale };
      const renderMode = useMask ? "grayscale-mask" as const : "vector" as const;
      const paintGlyph: PaintTextGlyph = {
        glyphId: glyph.glyphId, cluster: glyph.cluster, clusterEnd: glyph.clusterEnd, ...(fill ? { fill } : {}),
        x: glyph.x, y: glyph.y, width: glyph.width, height: glyph.height, path, pathScale: resolved.fontScale, outline,
        fontAssetId: glyph.fontAssetId, fontIntegrity: glyph.fontIntegrity, renderMode,
        fontSize: text.fontSize,
        ...(variation ? { variationKey: variation } : {}), ...(glyph.rotation ? { rotation: glyph.rotation } : {}), ...(glyph.scaleX ? { scaleX: glyph.scaleX } : {}),
      };
      if (renderMode === "vector") {
        paintGlyph.mesh = glyphPathToMesh(path, resolved.fontScale, outline, glyph.x, glyph.y) ?? undefined;
        if (paintGlyph.mesh && glyph.scaleX && glyph.scaleX !== 1) {
          paintGlyph.mesh = transformPathMesh(paintGlyph.mesh, { scaleX: glyph.scaleX, originX: glyph.x, originY: glyph.y });
        }
        if (text.stroke && text.strokeWidth) {
          paintGlyph.stroke = text.stroke; paintGlyph.strokePaint = text.strokePaint; paintGlyph.strokeWidth = text.strokeWidth; paintGlyph.strokeOpacity = text.strokeOpacity;
          paintGlyph.strokeMesh = glyphPathToStrokeMesh(path, resolved.fontScale, outline, glyph.x, glyph.y, text.strokeWidth) ?? undefined;
          if (paintGlyph.strokeMesh && glyph.scaleX && glyph.scaleX !== 1) {
            paintGlyph.strokeMesh = transformPathMesh(paintGlyph.strokeMesh, { scaleX: glyph.scaleX, originX: glyph.x, originY: glyph.y });
          }
        }
        if (glyph.rotation) {
          paintGlyph.mesh = paintGlyph.mesh ? transformPathMesh(paintGlyph.mesh, { rotation: glyph.rotation, originX: glyph.x, originY: glyph.y }) : undefined;
          paintGlyph.strokeMesh = paintGlyph.strokeMesh ? transformPathMesh(paintGlyph.strokeMesh, { rotation: glyph.rotation, originX: glyph.x, originY: glyph.y }) : undefined;
        }
      }
      if (resolved.face.hasColorLayers()) {
        const layers = resolved.face.getGlyphColorLayers(glyph.glyphId);
        if (layers.length) {
          const palette = resolved.face.getColorPalettes()[0]?.colors ?? [];
          paintGlyph.renderMode = "color-layers";
          paintGlyph.colorGlyph = { kind: "layers", layers: layers.flatMap((layer) => {
            const extents = resolved.font.glyphExtents(layer.glyph);
            const layerPath = resolved.font.glyphToPath(layer.glyph);
            if (!extents || !layerPath) return [];
            const layerOutline = { x: extents.xBearing, y: extents.yBearing, width: extents.width, height: extents.height };
            const layerX = glyph.x + (glyph.xBearing - extents.xBearing) * resolved.fontScale;
            const layerY = glyph.y + (glyph.yBearing - extents.yBearing) * resolved.fontScale;
            let mesh = glyphPathToMesh(layerPath, resolved.fontScale, layerOutline, layerX, layerY) ?? undefined;
            if (mesh && glyph.rotation) mesh = transformPathMesh(mesh, { rotation: glyph.rotation, originX: glyph.x, originY: glyph.y });
            return [{ fill: layer.colorIndex === undefined ? (fill ?? "#000000ff") : colorToHex(palette[layer.colorIndex] ?? { red: 0, green: 0, blue: 0, alpha: 255 }), path: layerPath, pathScale: resolved.fontScale, outline: { x: layerOutline.x, y: layerOutline.y }, x: layerX, y: layerY, mesh }];
          }) };
        }
      }
      if (resolved.face.hasColorPng()) {
        const png = resolved.font.getGlyphColorPng(glyph.glyphId);
        if (png?.length) { paintGlyph.renderMode = "color-bitmap"; paintGlyph.colorGlyph = { kind: "bitmap", mimeType: "image/png", bytes: png }; }
      }
      const svgDocument = svgGlyphDocument(resolved.face, glyph.glyphId);
      if (svgDocument) {
        paintGlyph.renderMode = "color-svg";
        paintGlyph.colorGlyph = { kind: "bitmap", mimeType: "image/svg+xml", bytes: new TextEncoder().encode(svgDocument) };
      }
      if (resolved.face.hasColorPaint() && resolved.face.glyphHasColorPaint(glyph.glyphId)) {
        paintGlyph.renderMode = "color-svg";
        paintGlyph.colorGlyph = { kind: "paint-graph" };
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
        resolvedFonts.push({ source, face, font, fontScale: node.content.fontSize / face.upem, metrics: font.hExtents() });
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
