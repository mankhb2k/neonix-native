import type * as HarfBuzz from "harfbuzzjs";
import type { PaintTextGlyph } from "../../paint/paint-types";
import type {
  RuntimeDiagnosticV2,
  RuntimeProjectV2,
  RuntimeTextLayoutV2,
  RuntimeTextV2,
} from "./types";

export type RuntimeTextFontResolverV2 = (font: {
  assetId: string;
  uri: string;
  integrity: string;
}) => Promise<ArrayBuffer | Uint8Array | null>;

export type RuntimeTextShaperLoaderV2 = () => Promise<typeof HarfBuzz>;

export type PrepareRuntimeTextResultV2 = {
  project: RuntimeProjectV2;
  diagnostics: RuntimeDiagnosticV2[];
};

function layoutText(
  hb: typeof HarfBuzz,
  text: RuntimeTextV2,
  bytes: ArrayBuffer | Uint8Array,
): RuntimeTextLayoutV2 {
  const blob = new hb.Blob(bytes);
  const face = new hb.Face(blob);
  const font = new hb.Font(face);
  const fontScale = text.fontSize / face.upem;
  const metrics = font.hExtents();
  const glyphs: PaintTextGlyph[] = [];
  const glyphHeight = (metrics.ascender - metrics.descender) * fontScale;
  const sourceLines = text.text.split("\n");
  const lineTop = text.verticalAlign === "middle"
    ? (text.height - text.lineHeight * sourceLines.length) / 2
    : text.verticalAlign === "bottom"
      ? text.height - text.lineHeight * sourceLines.length
      : 0;
  const lines: RuntimeTextLayoutV2["lines"] = [];

  for (const [lineIndex, sourceLine] of sourceLines.entries()) {
    const buffer = new hb.Buffer();
    buffer.addText(sourceLine);
    buffer.setLanguage(text.language);
    buffer.guessSegmentProperties();
    hb.shape(font, buffer);
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    let penX = 0;
    for (let index = 0; index < infos.length; index += 1) {
      const info = infos[index]!;
      const position = positions[index]!;
      const extents = font.glyphExtents(info.codepoint);
      if (extents && extents.width !== 0 && extents.height !== 0) {
        glyphs.push({
          glyphId: info.codepoint,
          cluster: info.cluster,
          x: penX + (position.xOffset + extents.xBearing) * fontScale,
          y: -(position.yOffset + extents.yBearing) * fontScale,
          width: extents.width * fontScale,
          height: -extents.height * fontScale,
          path: font.glyphToPath(info.codepoint),
          pathScale: fontScale,
          outline: {
            x: extents.xBearing,
            y: extents.yBearing,
            width: extents.width,
            height: extents.height,
          },
        });
      }
      penX += position.xAdvance * fontScale;
      if (index < infos.length - 1) penX += text.letterSpacing;
    }
    const alignedX = text.align === "center"
      ? (text.width - penX) / 2
      : text.align === "right"
        ? text.width - penX
        : 0;
    const baselineY = lineTop + lineIndex * text.lineHeight + (text.lineHeight - glyphHeight) / 2 + metrics.ascender * fontScale;
    const lineGlyphStart = glyphs.length - infos.filter((info) => {
      const extents = font.glyphExtents(info.codepoint);
      return extents && extents.width !== 0 && extents.height !== 0;
    }).length;
    for (let glyphIndex = lineGlyphStart; glyphIndex < glyphs.length; glyphIndex += 1) {
      glyphs[glyphIndex]!.x += alignedX;
      glyphs[glyphIndex]!.y += baselineY;
    }
    lines.push({ baselineY, advanceWidth: penX });
  }
  return {
    unitsPerEm: face.upem,
    ascender: metrics.ascender,
    descender: metrics.descender,
    glyphs,
    lines,
  };
}

/**
 * Resolve exact font bytes and produce stable glyph outlines before a backend
 * receives the paint frame. This is intentionally separate from the pure,
 * synchronous Protocol V2 compiler.
 */
export async function prepareRuntimeProjectV2Text(
  project: RuntimeProjectV2,
  resolveFont: RuntimeTextFontResolverV2,
  loadHarfBuzz: RuntimeTextShaperLoaderV2,
): Promise<PrepareRuntimeTextResultV2> {
  const diagnostics: RuntimeDiagnosticV2[] = [];
  const textNodes = project.nodes.filter((node) => node.content.kind === "text");
  if (textNodes.length === 0) return { project, diagnostics };
  let hb: typeof HarfBuzz;
  try {
    hb = await loadHarfBuzz();
  } catch (error) {
    return {
      project,
      diagnostics: textNodes.map((node) => ({
        severity: "error" as const,
        code: "runtime_v2_text_shaper_unavailable",
        message: `Text shaper failed to load for ${node.id}: ${error instanceof Error ? error.message : String(error)}`,
        nodeId: node.id,
      })),
    };
  }
  const nodes = await Promise.all(project.nodes.map(async (node) => {
    if (node.content.kind !== "text") return node;
    try {
      const bytes = await resolveFont({
        assetId: node.content.fontAssetId,
        uri: node.content.fontUri,
        integrity: node.content.fontIntegrity,
      });
      if (!bytes) {
        diagnostics.push({
          severity: "error",
          code: "runtime_v2_font_unavailable",
          message: `Font asset ${node.content.fontAssetId} is unavailable for text layer ${node.id}`,
          nodeId: node.id,
        });
        return node;
      }
      return {
        ...node,
        content: { ...node.content, layout: layoutText(hb, node.content, bytes) },
      };
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code: "runtime_v2_text_layout_failed",
        message: `Text layout failed for ${node.id}: ${error instanceof Error ? error.message : String(error)}`,
        nodeId: node.id,
      });
      return node;
    }
  }));
  return { project: { ...project, nodes }, diagnostics };
}
