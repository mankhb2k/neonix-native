import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { VisualRuntimeProject, VisualRuntimeText } from "./types";
import { prepareVisualRuntimeProjectText } from "./text-layout";

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
    expect(["color-bitmap", "color-layers", "color-svg"]).toContain(emojiGlyph?.renderMode);
    expect(emojiGlyph?.colorGlyph).toBeDefined();
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
