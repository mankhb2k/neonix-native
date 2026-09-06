import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { VisualRuntimeProject, VisualRuntimeText } from "./types";
import { measureVisualRuntimeText, prepareVisualRuntimeProjectText } from "./text-layout";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const repoRoot = path.resolve(process.cwd(), "../..");
const notoSansPath = path.join(repoRoot, "apps/web/public/preview/font/Noto_Sans/NotoSans-Regular.ttf");
const notoArabicPath = path.join(repoRoot, "apps/web/public/preview/font/Noto_Sans_Arabic/NotoSansArabic-Regular.ttf");
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
