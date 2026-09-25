import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../src/index";
import { prepareHtmlTextSizing, resolveTextContentWidth, textSizingCacheKey } from "../src/compiler/text-sizing";
import type { Style } from "../src/compiler/model";
import type { HtmlCompilerFontAsset } from "../src/source";

const repoRoot = path.resolve(process.cwd(), "../..");
const interRegularPath = path.join(repoRoot, "apps/web/public/preview/font/Inter/Inter-400.ttf");
const loadHarfBuzz = () => import("harfbuzzjs");

const FONT_ASSET: HtmlCompilerFontAsset = {
  id: "inter-regular",
  kind: "font",
  uri: "/preview/font/Inter/Inter-400.ttf",
  weight: 400,
  integrity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  family: "Inter",
  style: "normal",
};

const VIEWPORT = { width: 1920, height: 1080 };

function styleOf(declarations: Record<string, string>): Style {
  return new Map(Object.entries(declarations));
}

function docWithText(text: string, widthPx: number, fontSize: number): string {
  return `<!doctype html><html><head>
    <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
    <style>
      html, body { width: 1920px; height: 1080px; margin: 0; }
      #para { width: ${widthPx}px; height: auto; font-family: Inter; font-size: ${fontSize}px; line-height: 1.2; }
    </style>
  </head><body><div id="para">${text}</div></body></html>`;
}

describe("resolveTextContentWidth", () => {
  it("a content-box declared width already IS the content width - no subtraction", () => {
    const style = styleOf({ width: "200px", padding: "10px", border: "2px solid #000" });
    expect(resolveTextContentWidth(style, 500, 16, VIEWPORT)).toBe(200);
  });

  it("subtracts padding and border from a border-box declared width", () => {
    const style = styleOf({ width: "200px", padding: "10px", border: "2px solid #000", "box-sizing": "border-box" });
    expect(resolveTextContentWidth(style, 500, 16, VIEWPORT)).toBe(200 - 20 - 4);
  });

  it("falls back to the containing width when no declared width is set", () => {
    const style = styleOf({ padding: "10px" });
    expect(resolveTextContentWidth(style, 500, 16, VIEWPORT)).toBe(500 - 20);
  });
});

describe("textSizingCacheKey", () => {
  it("is stable for identical inputs", () => {
    const style = styleOf({ "font-family": "Inter", "line-height": "1.2" });
    expect(textSizingCacheKey("Hello", style, 32, 200)).toBe(textSizingCacheKey("Hello", style, 32, 200));
  });

  it("differs when the text, font size or content width changes", () => {
    const style = styleOf({ "font-family": "Inter" });
    const base = textSizingCacheKey("Hello", style, 32, 200);
    expect(textSizingCacheKey("World", style, 32, 200)).not.toBe(base);
    expect(textSizingCacheKey("Hello", style, 40, 200)).not.toBe(base);
    expect(textSizingCacheKey("Hello", style, 32, 260)).not.toBe(base);
  });
});

describe("prepareHtmlTextSizing", () => {
  it("real-measures a height that differs from the character-count heuristic for glyph-width-heavy text", async () => {
    // Every real Latin glyph in "M"/"W" renders far wider than the
    // heuristic's flat fontSize*0.55 average, and the heuristic ignores word
    // boundaries entirely (it chops by raw character count) while real
    // wrapping only breaks between words - so at a narrow width the two
    // algorithms are virtually guaranteed to disagree on line count.
    const text = "MMMM WWWW MMMM WWWW MMMM WWWW MMMM WWWW";
    const html = docWithText(text, 150, 32);

    const heuristic = compileDocument({ html, fontAssets: [FONT_ASSET] });
    expect(heuristic.status).toBe("success");
    const heuristicHeight = heuristic.protocol?.layers.find((layer) => layer.id === "para")?.frame?.height;
    expect(typeof heuristicHeight).toBe("number");

    const bytes = await readFile(interRegularPath);
    const textSizing = await prepareHtmlTextSizing(html, "", {
      fontAssets: [FONT_ASSET],
      resolveFontBytes: async () => bytes,
      loadHarfBuzz,
    });
    expect(textSizing.size).toBeGreaterThan(0);

    const measured = compileDocument({ html, fontAssets: [FONT_ASSET] }, { textSizing });
    expect(measured.status).toBe("success");
    const measuredHeight = measured.protocol?.layers.find((layer) => layer.id === "para")?.frame?.height;
    expect(typeof measuredHeight).toBe("number");

    expect(measuredHeight).not.toBe(heuristicHeight);
  });

  it("only measures a text leaf with an explicit px width and height:auto - a %/auto width is left for the heuristic", async () => {
    const html = `<!doctype html><html><head>
      <meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'>
      <style>
        html, body { width: 1920px; height: 1080px; margin: 0; }
        #wrap { width: 800px; }
        #auto-width { width: auto; height: auto; font-family: Inter; font-size: 32px; }
      </style>
    </head><body><div id="wrap"><div id="auto-width">Hello World</div></div></body></html>`;

    const bytes = await readFile(interRegularPath);
    const textSizing = await prepareHtmlTextSizing(html, "", {
      fontAssets: [FONT_ASSET],
      resolveFontBytes: async () => bytes,
      loadHarfBuzz,
    });
    expect(textSizing.size).toBe(0);
  });

  it("never throws when font bytes can't be resolved, and leaves the lookup empty", async () => {
    const html = docWithText("Hello World", 200, 24);
    const textSizing = await prepareHtmlTextSizing(html, "", {
      fontAssets: [FONT_ASSET],
      resolveFontBytes: async () => null,
      loadHarfBuzz,
    });
    expect(textSizing.size).toBe(0);
  });

  it("omitting textSizing entirely keeps compileDocument's output byte-identical to before", () => {
    const html = docWithText("MMMM WWWW MMMM WWWW", 150, 32);
    const withoutOption = compileDocument({ html, fontAssets: [FONT_ASSET] });
    const withUndefinedTextSizing = compileDocument({ html, fontAssets: [FONT_ASSET] }, { textSizing: undefined });
    expect(withUndefinedTextSizing.protocol).toEqual(withoutOption.protocol);
  });
});
