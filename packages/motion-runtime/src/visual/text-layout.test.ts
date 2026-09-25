import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { VisualRuntimeProject, VisualRuntimeText } from "./types";
import { measureVisualRuntimeText, measureVisualRuntimeTextIntrinsicWidths, prepareVisualRuntimeProjectText, shapeFeatures } from "./text-layout";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const repoRoot = path.resolve(process.cwd(), "../..");
const notoSansPath = path.join(repoRoot, "apps/web/public/preview/font/Noto_Sans/NotoSans-400.ttf");
const interRegularPath = path.join(repoRoot, "apps/web/public/preview/font/Inter/Inter-400.ttf");
const interBoldPath = path.join(repoRoot, "apps/web/public/preview/font/Inter/Inter-700.ttf");
const interItalicPath = path.join(repoRoot, "apps/web/public/preview/font/Inter/Inter-400-Italic.ttf");
const notoArabicPath = path.join(repoRoot, "apps/web/public/preview/font/Noto_Sans_Arabic/NotoSansArabic-400.ttf");
const notoEmojiPath = path.join(repoRoot, "apps/web/public/preview/font/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf");

function textContent(overrides: Partial<VisualRuntimeText> = {}): VisualRuntimeText {
  return {
    kind: "text",
    text: "Hello",
    fontAssetId: "roboto",
    fontUri: "/preview/font/Noto_Sans/NotoSans-Regular.ttf",
    fontIntegrity: "sha256:roboto",
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 0,
    align: "left",
    verticalAlign: "top",
    wrap: "none",
    overflow: "visible",
    direction: "ltr",
    language: "en",
    fill: "#ffffff",
    width: 600,
    height: 120,
    ...overrides,
  };
}

function project(content: VisualRuntimeText): VisualRuntimeProject {
  return {
    format: "motion-runtime",
    formatVersion: 2,
    id: "text-layout-test",
    composition: { width: 600, height: 120, fps: 30, duration: 1 },
    view: { background: "#000000", colorSpace: "srgb" },
    nodes: [{
      id: "text",
      parentId: null,
      order: 0,
      timing: { start: 0, duration: 1 },
      opacity: 1,
      visible: true,
      localMatrix: identity,
      worldMatrix: identity,
      content,
    }],
  } as VisualRuntimeProject;
}

describe("runtime text shaping and materialization", () => {
  it("exports intrinsic dimensions from the same shaped lines as Preview", async () => {
    const bytes = await readFile(notoSansPath);
    const measurement = await measureVisualRuntimeText(
      textContent({ text: "Hello\nWorld", lineHeight: 40, whiteSpace: "pre-wrap", sizing: "auto-width-height" }),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );

    expect(measurement?.lineCount).toBe(2);
    expect(measurement?.height).toBe(80);
    expect(measurement?.width).toBeGreaterThan(1);
    expect(measurement?.resolvedFontAssetIds).toEqual(["roboto"]);
  });

  it("keeps GlyphRun separate and selects a grayscale mask for small plain text", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent()),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout?.runs.length).toBeGreaterThan(0);
    expect(content.layout?.runs[0]?.glyphs[0]).not.toHaveProperty("mesh");
    expect(content.layout?.glyphs[0]?.renderMode).toBe("grayscale-mask");
    expect(content.layout?.glyphs[0]?.fontIntegrity).toBe("sha256:roboto");
  });

  it("wraps word lines against the frame width and advances by line-height", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hello world from Neonix", width: 150, lineHeight: 48, wrap: "word" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout?.lines.length).toBeGreaterThan(1);
    expect(content.layout?.lines[1]!.baselineY - content.layout?.lines[0]!.baselineY).toBe(48);
    expect(content.layout?.glyphs.every((glyph) => glyph.x <= 150)).toBe(true);
  });

  it("breaks at any grapheme cluster boundary under wrap: character (word-break: break-all)", async () => {
    const bytes = await readFile(notoSansPath);
    const longWord = "Supercalifragilisticexpialidocious";
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: longWord, width: 150, contentWidth: 150, wrap: "character" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout!.lines.length).toBeGreaterThan(1);
    expect(content.layout!.lines.every((line) => line.advanceWidth <= 150)).toBe(true);
  });

  it("keeps plain wrap: word overflowing an unbreakable long word (the regression case break-word/break-all must not affect)", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hi there Supercalifragilisticexpialidocious end", width: 150, contentWidth: 150, wrap: "word" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout!.lines.some((line) => line.advanceWidth > 150)).toBe(true);
  });

  it("wraps normally but breaks only the one overlong word under wrap: word-break-long (overflow-wrap: break-word)", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hi there Supercalifragilisticexpialidocious end", width: 150, contentWidth: 150, wrap: "word-break-long" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout!.lines.length).toBeGreaterThan(1);
    expect(content.layout!.lines.every((line) => line.advanceWidth <= 150)).toBe(true);
  });

  it("behaves exactly like normal word-wrap under wrap: word-break-long when no single word is overlong", async () => {
    const bytes = await readFile(notoSansPath);
    const text = "Hi there my friend how are you today";
    const asWord = await prepareVisualRuntimeProjectText(
      project(textContent({ text, width: 150, contentWidth: 150, wrap: "word" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const asBreakLong = await prepareVisualRuntimeProjectText(
      project(textContent({ text, width: 150, contentWidth: 150, wrap: "word-break-long" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const wordContent = asWord.project.nodes[0]!.content;
    const breakLongContent = asBreakLong.project.nodes[0]!.content;
    expect(wordContent.kind).toBe("text");
    expect(breakLongContent.kind).toBe("text");
    if (wordContent.kind !== "text" || breakLongContent.kind !== "text") return;
    expect(breakLongContent.layout!.lines.map((line) => Math.round(line.advanceWidth * 100))).toEqual(
      wordContent.layout!.lines.map((line) => Math.round(line.advanceWidth * 100)),
    );
  });

  it("offsets only the first line's glyphs by text-indent, not later wrapped lines", async () => {
    const bytes = await readFile(notoSansPath);
    const baseline = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hello world from Neonix and more text to wrap", width: 200, contentWidth: 200, wrap: "word" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const indented = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hello world from Neonix and more text to wrap", width: 200, contentWidth: 200, wrap: "word", textIndent: 40 })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const baseContent = baseline.project.nodes[0]!.content;
    const indentContent = indented.project.nodes[0]!.content;
    expect(baseContent.kind).toBe("text");
    expect(indentContent.kind).toBe("text");
    if (baseContent.kind !== "text" || indentContent.kind !== "text") return;
    expect(indentContent.layout!.lines.length).toBeGreaterThan(1);
    // First line's first glyph shifts right by exactly the indent...
    expect(indentContent.layout!.glyphs[0]!.x).toBeCloseTo(baseContent.layout!.glyphs[0]!.x + 40, 5);
    // ...but a later line's first glyph does not - it stays near the box's
    // left edge, nowhere close to shifting by the 40px indent too. (The
    // reduced first-line width can itself push an extra word onto a later
    // line, so this compares the indented render against itself rather than
    // assuming baseline/indented share identical line counts/content.)
    const firstLineBaselineY = indentContent.layout!.lines[0]!.baselineY;
    const laterLineFirstGlyph = indentContent.layout!.glyphs.find((glyph) => glyph.y > firstLineBaselineY)!;
    expect(laterLineFirstGlyph.x).toBeLessThan(20);
  });

  it("allows a negative text-indent (hanging indent) to shift the first line left", async () => {
    const bytes = await readFile(notoSansPath);
    const baseline = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hello", wrap: "none" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const hanging = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hello", wrap: "none", textIndent: -20 })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const baseContent = baseline.project.nodes[0]!.content;
    const hangingContent = hanging.project.nodes[0]!.content;
    expect(baseContent.kind).toBe("text");
    expect(hangingContent.kind).toBe("text");
    if (baseContent.kind !== "text" || hangingContent.kind !== "text") return;
    expect(hangingContent.layout!.glyphs[0]!.x).toBeCloseTo(baseContent.layout!.glyphs[0]!.x - 20, 5);
  });

  it("requests the OpenType smcp feature for font-variant: small-caps, and only then", async () => {
    const hb = await import("harfbuzzjs");
    expect(shapeFeatures(hb, textContent({ smallCaps: true }))?.map((feature) => feature.tag)).toEqual(["smcp"]);
    expect(shapeFeatures(hb, textContent({ smallCaps: false }))).toBeUndefined();
    expect(shapeFeatures(hb, textContent({}))).toBeUndefined();
  });

  it("shapes small-caps text without corrupting glyphs on a font with no smcp table (a standards-compliant no-op)", async () => {
    // Inter-400 has no smcp OpenType feature (confirmed against Inter-400.ttf
    // directly: requesting the feature produces byte-identical glyph ids and
    // positions to the same text shaped without it). This locks in that the
    // request degrades safely instead of corrupting shaping when unsupported.
    const bytes = await readFile(interRegularPath);
    const plain = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "hello", wrap: "none" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const smallCaps = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "hello", wrap: "none", smallCaps: true })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const plainContent = plain.project.nodes[0]!.content;
    const smallCapsContent = smallCaps.project.nodes[0]!.content;
    expect(plainContent.kind).toBe("text");
    expect(smallCapsContent.kind).toBe("text");
    if (plainContent.kind !== "text" || smallCapsContent.kind !== "text") return;
    expect(smallCapsContent.layout!.glyphs.map((glyph) => glyph.glyphId)).toEqual(plainContent.layout!.glyphs.map((glyph) => glyph.glyphId));
    expect(smallCapsContent.layout!.glyphs).toHaveLength(5);
  });

  it("shifts only the styled span's glyph (CSS vertical-align), not the rest of the line", async () => {
    const bytes = await readFile(notoSansPath);
    const plain = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "AB" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const shifted = await prepareVisualRuntimeProjectText(
      project(textContent({
        text: "AB",
        spanStyles: [{ start: 0, end: 1, fontAssetIds: ["noto"], fontSize: 32, baselineShift: 10 }],
      })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const plainContent = plain.project.nodes[0]!.content;
    const shiftedContent = shifted.project.nodes[0]!.content;
    expect(plainContent.kind).toBe("text");
    expect(shiftedContent.kind).toBe("text");
    if (plainContent.kind !== "text" || shiftedContent.kind !== "text") return;
    // A positive baseline-shift moves the glyph down (larger y) in this
    // coordinate system, where y already grows downward line-to-line.
    // Compares the same glyph ("A") against its own unshifted render,
    // rather than against sibling glyph "B" (whose natural y differs
    // slightly just from having a different shape/extents).
    expect(shiftedContent.layout!.glyphs[0]!.y).toBeCloseTo(plainContent.layout!.glyphs[0]!.y + 10, 5);
    // "B" (unstyled) is unaffected.
    expect(shiftedContent.layout!.glyphs[1]!.y).toBeCloseTo(plainContent.layout!.glyphs[1]!.y, 5);
  });

  it("applies a negative baseline-shift (raises the glyph) in the opposite direction", async () => {
    const bytes = await readFile(notoSansPath);
    const plain = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "AB" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const shifted = await prepareVisualRuntimeProjectText(
      project(textContent({
        text: "AB",
        spanStyles: [{ start: 0, end: 1, fontAssetIds: ["noto"], fontSize: 32, baselineShift: -10 }],
      })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const plainContent = plain.project.nodes[0]!.content;
    const shiftedContent = shifted.project.nodes[0]!.content;
    expect(plainContent.kind).toBe("text");
    expect(shiftedContent.kind).toBe("text");
    if (plainContent.kind !== "text" || shiftedContent.kind !== "text") return;
    expect(shiftedContent.layout!.glyphs[0]!.y).toBeCloseTo(plainContent.layout!.glyphs[0]!.y - 10, 5);
  });

  it("lets a span's own baseline-shift override the text-wide default instead of adding to it", async () => {
    const bytes = await readFile(notoSansPath);
    const textWideOnly = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "AB", baselineShift: 3 })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const spanOverride = await prepareVisualRuntimeProjectText(
      project(textContent({
        text: "AB",
        baselineShift: 3,
        spanStyles: [{ start: 0, end: 1, fontAssetIds: ["noto"], fontSize: 32, baselineShift: 10 }],
      })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const textWideContent = textWideOnly.project.nodes[0]!.content;
    const overrideContent = spanOverride.project.nodes[0]!.content;
    expect(textWideContent.kind).toBe("text");
    expect(overrideContent.kind).toBe("text");
    if (textWideContent.kind !== "text" || overrideContent.kind !== "text") return;
    // "A" uses its own span shift (10), not the text-wide one (3) plus its own.
    expect(overrideContent.layout!.glyphs[0]!.y).toBeCloseTo(textWideContent.layout!.glyphs[0]!.y - 3 + 10, 5);
    // "B" (unstyled) still falls back to the text-wide shift in both renders.
    expect(overrideContent.layout!.glyphs[1]!.y).toBeCloseTo(textWideContent.layout!.glyphs[1]!.y, 5);
  });

  it("passes text-decoration-style through to the generated decoration geometry, unchanged from solid otherwise", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({
        text: "Hello",
        textDecoration: { underline: { fill: "#ff0000", thickness: 2, style: "wavy" } },
      })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout!.decorations).toHaveLength(1);
    expect(content.layout!.decorations![0]).toMatchObject({ fill: "#ff0000", height: 2, style: "wavy" });
  });

  it("omits the style field for a plain (solid) decoration, same as before this feature existed", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({
        text: "Hello",
        textDecoration: { underline: { fill: "#ff0000", thickness: 2 } },
      })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout!.decorations![0]!.style).toBeUndefined();
  });

  it("trims grapheme clusters and shapes an ellipsis inside a clipped line", async () => {
    const bytes = await readFile(notoSansPath);
    const value = "Hello world from Neonix";
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: value, width: 150, contentWidth: 150, whiteSpace: "nowrap", wrap: "none", overflow: "clip", textOverflow: "ellipsis", maxLines: 1 })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout?.lines).toHaveLength(1);
    expect(content.layout?.glyphs.length).toBeLessThan(value.length);
    expect(content.layout?.glyphs.at(-1)?.cluster ?? value.length).toBeLessThan(value.length);
  });

  it("maps text-rendering intent to safe mask/vector modes", async () => {
    const bytes = await readFile(notoSansPath);
    const prepare = (textRendering: VisualRuntimeText["textRendering"]) => prepareVisualRuntimeProjectText(
      project(textContent({ textRendering })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const speed = await prepare("optimizeSpeed");
    const precision = await prepare("geometricPrecision");
    const speedContent = speed.project.nodes[0]!.content;
    const precisionContent = precision.project.nodes[0]!.content;
    expect(speedContent.kind === "text" ? speedContent.layout?.glyphs[0]?.renderMode : undefined).toBe("grayscale-mask");
    expect(precisionContent.kind === "text" ? precisionContent.layout?.glyphs[0]?.renderMode : undefined).toBe("vector");
  });

  it("uses contentWidth and contentOffsetX/Y for text layout", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "A B C", width: 500, height: 120, contentWidth: 300, contentOffsetX: 20, contentOffsetY: 12, justify: "all" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout?.lines[0]?.advanceWidth).toBeCloseTo(300, 5);
    expect(Math.min(...(content.layout?.glyphs.map((glyph) => glyph.x) ?? []))).toBeGreaterThanOrEqual(20);
    expect(Math.min(...(content.layout?.glyphs.map((glyph) => glyph.y) ?? []))).toBeGreaterThan(12);
  });

  it("places vertical-rl and vertical-lr columns at opposite inline edges", async () => {
    const bytes = await readFile(notoSansPath);
    const resolve = async (writingMode: "vertical-rl" | "vertical-lr") => {
      const result = await prepareVisualRuntimeProjectText(
        project(textContent({ text: "VERT", writingMode, width: 500, height: 120, contentWidth: 300, contentOffsetX: 12 })),
        async () => bytes,
        async () => import("harfbuzzjs"),
      );
      const content = result.project.nodes[0]!.content;
      if (content.kind !== "text") throw new Error("Expected text runtime content");
      return Math.min(...content.layout!.glyphs.map((glyph) => glyph.x));
    };
    const verticalRlX = await resolve("vertical-rl");
    const verticalLrX = await resolve("vertical-lr");
    expect(verticalRlX).toBeCloseTo(12 + 300 - 38, 5);
    expect(verticalLrX).toBeCloseTo(12, 5);
    expect(verticalRlX).toBeGreaterThan(verticalLrX);
  });

  it("normalizes collapsible whitespace before shaping", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "A   B\n C", whiteSpace: "normal", wrap: "none" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout?.lines).toHaveLength(1);
    expect(content.layout?.lines[0]?.advanceWidth).toBeLessThan(150);
  });

  it("preserves authored hard breaks under normal whitespace", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hello\nWorld", whiteSpace: "normal", hardBreaks: [5], wrap: "none" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout?.lines).toHaveLength(2);
    expect(content.layout?.lines[1]!.baselineY - content.layout?.lines[0]!.baselineY).toBe(38);
    expect(content.layout?.glyphs.map((glyph) => glyph.cluster)).toContain(6);
  });

  it("preserves newlines and repeated spaces for pre-wrap", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "A   B\n C", whiteSpace: "pre-wrap", wrap: "word" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout?.lines).toHaveLength(2);
    expect(content.layout?.lines[0]?.advanceWidth).toBeGreaterThan(content.layout?.lines[1]?.advanceWidth ?? 0);
  });

  it("justifies wrapped lines but leaves the final line natural", async () => {
    const bytes = await readFile(notoSansPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({ text: "Hello world from Neonix", width: 500, contentWidth: 240, wrap: "word", justify: "line" })),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(content.layout?.lines.length).toBeGreaterThan(1);
    expect(content.layout?.lines[0]?.advanceWidth).toBeCloseTo(240, 5);
    expect(content.layout?.lines.at(-1)?.advanceWidth).toBeLessThan(240);
  });

  it("resolves a different font run when the primary face lacks a grapheme", async () => {
    const [notoSans, notoEmoji] = await Promise.all([readFile(notoSansPath), readFile(notoEmojiPath)]);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({
        text: "A 👋",
        fontFallbacks: [{ assetId: "noto-emoji", uri: "/preview/font/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf", integrity: "sha256:noto" }],
      })),
      async (font) => font.assetId === "noto-emoji" ? notoEmoji : notoSans,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(new Set(content.layout?.runs.map((run) => run.fontAssetId))).toEqual(new Set(["roboto", "noto-emoji"]));
    const emojiGlyph = content.layout?.glyphs.find((glyph) => glyph.fontAssetId === "noto-emoji");
    expect(emojiGlyph).toBeDefined();
    expect(["color-bitmap", "color-layers", "color-paint", "color-svg"]).toContain(emojiGlyph?.renderMode);
    expect(emojiGlyph?.colorGlyph).toBeDefined();
    if (emojiGlyph?.colorGlyph?.kind === "paint-graph") expect(emojiGlyph.colorGlyphFallback?.mimeType).toBe("image/svg+xml");
  });

  it("shapes mixed Protocol inline spans with their own font assets and sizes", async () => {
    const [regular, bold, italic] = await Promise.all([readFile(interRegularPath), readFile(interBoldPath), readFile(interItalicPath)]);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({
        text: "Prefix bold italic",
        fontAssetId: "inter-regular",
        fontUri: "/preview/font/Inter/Inter_18pt-Regular.ttf",
        fontIntegrity: "sha256:inter-regular",
        fontFallbacks: [
          { assetId: "inter-bold", uri: "/preview/font/Inter/Inter_18pt-Bold.ttf", integrity: "sha256:inter-bold" },
          { assetId: "inter-italic", uri: "/preview/font/Inter/Inter_18pt-Italic.ttf", integrity: "sha256:inter-italic" },
        ],
        spanStyles: [
          { start: 0, end: 7, fontAssetIds: ["inter-regular"], fontSize: 32, fontWeight: 400, fontStyle: "normal" },
          { start: 7, end: 11, fontAssetIds: ["inter-bold"], fontSize: 40, fontWeight: 700, fontStyle: "normal" },
          { start: 12, end: 18, fontAssetIds: ["inter-italic"], fontSize: 32, fontWeight: 400, fontStyle: "italic" },
        ],
      })),
      async (font) => font.assetId === "inter-bold" ? bold : font.assetId === "inter-italic" ? italic : regular,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    expect(new Set(content.layout?.runs.map((run) => run.fontAssetId))).toEqual(new Set(["inter-regular", "inter-bold", "inter-italic"]));
    const boldGlyph = content.layout?.glyphs.find((glyph) => glyph.cluster >= 7 && glyph.cluster < 11);
    expect(boldGlyph?.fontAssetId).toBe("inter-bold");
    expect(boldGlyph?.fontSize).toBe(40);
  });

  it("shapes an Arabic RTL run before a renderer receives its glyphs", async () => {
    const arabic = await readFile(notoArabicPath);
    const result = await prepareVisualRuntimeProjectText(
      project(textContent({
        text: "السلام عليكم",
        fontAssetId: "noto-arabic",
        fontUri: "/preview/font/Noto_Sans_Arabic/NotoSansArabic-Regular.ttf",
        fontIntegrity: "sha256:noto-arabic",
        fontSize: 96,
        direction: "rtl",
        language: "ar",
      })),
      async () => arabic,
      async () => import("harfbuzzjs"),
    );
    const content = result.project.nodes[0]!.content;
    expect(content.kind).toBe("text");
    if (content.kind !== "text") return;
    const run = content.layout?.runs[0];
    expect(run).toMatchObject({ fontAssetId: "noto-arabic", direction: "rtl", language: "ar" });
    expect(run?.glyphs.length).toBeGreaterThan(0);
    expect(run?.glyphs.every((glyph) => glyph.fontAssetId === "noto-arabic")).toBe(true);
    expect(run?.glyphs.every((glyph) => Number.isFinite(glyph.advanceX) && Number.isFinite(glyph.advanceY))).toBe(true);
    expect(content.layout?.glyphs.every((glyph) => glyph.renderMode === "vector")).toBe(true);
  });
});

describe("measureVisualRuntimeTextIntrinsicWidths", () => {
  it("makes min-content equal max-content when the text can't wrap", async () => {
    const bytes = await readFile(notoSansPath);
    const widths = await measureVisualRuntimeTextIntrinsicWidths(
      textContent({ text: "Hello wide world", wrap: "none" }),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    expect(widths?.minContent).toBe(widths?.maxContent);
  });

  it("makes min-content equal max-content for a single word even when wrap is enabled", async () => {
    const bytes = await readFile(notoSansPath);
    const widths = await measureVisualRuntimeTextIntrinsicWidths(
      textContent({ text: "Supercalifragilistic", wrap: "word" }),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    expect(widths?.minContent).toBe(widths?.maxContent);
  });

  it("sets min-content to the widest single word and max-content to the full unwrapped line", async () => {
    const bytes = await readFile(notoSansPath);
    const fonts = async () => bytes;
    const loadHarfBuzz = async () => import("harfbuzzjs");
    const widths = await measureVisualRuntimeTextIntrinsicWidths(textContent({ text: "Hi World", wrap: "word" }), fonts, loadHarfBuzz);
    const fullLine = await measureVisualRuntimeText(textContent({ text: "Hi World", wrap: "none" }), fonts, loadHarfBuzz);
    const widestWord = await measureVisualRuntimeText(textContent({ text: "World", wrap: "none" }), fonts, loadHarfBuzz);
    const narrowestWord = await measureVisualRuntimeText(textContent({ text: "Hi", wrap: "none" }), fonts, loadHarfBuzz);

    expect(widths?.maxContent).toBe(fullLine?.width);
    expect(widths?.minContent).toBe(widestWord?.width);
    // Sanity: the two single-word measurements actually differ, or this
    // assertion would be trivially true regardless of which word min-content picked.
    expect(widestWord?.width).toBeGreaterThan(narrowestWord?.width ?? 0);
  });

  it("keeps min-content <= max-content for realistic mixed-length text", async () => {
    const bytes = await readFile(notoSansPath);
    const widths = await measureVisualRuntimeTextIntrinsicWidths(
      textContent({ text: "The quick brown fox jumps over the lazy dog", wrap: "word" }),
      async () => bytes,
      async () => import("harfbuzzjs"),
    );
    expect(widths).not.toBeNull();
    expect(widths!.minContent).toBeLessThanOrEqual(widths!.maxContent);
    expect(widths!.minContent).toBeGreaterThan(0);
  });

  it("wrapping at a width between min-content and max-content actually produces more than one line", async () => {
    const bytes = await readFile(notoSansPath);
    const fonts = async () => bytes;
    const loadHarfBuzz = async () => import("harfbuzzjs");
    const text = textContent({ text: "The quick brown fox jumps over the lazy dog", wrap: "word" });
    const widths = await measureVisualRuntimeTextIntrinsicWidths(text, fonts, loadHarfBuzz);
    const midWidth = (widths!.minContent + widths!.maxContent) / 2;
    const measured = await measureVisualRuntimeText({ ...text, width: midWidth, contentWidth: midWidth }, fonts, loadHarfBuzz);
    expect(measured!.lineCount).toBeGreaterThan(1);
    expect(measured!.width).toBeLessThanOrEqual(midWidth);
  });

  it("returns null when no font asset resolves, matching measureVisualRuntimeText", async () => {
    const widths = await measureVisualRuntimeTextIntrinsicWidths(
      textContent({ text: "Hello" }),
      async () => null,
      async () => import("harfbuzzjs"),
    );
    expect(widths).toBeNull();
  });
});
