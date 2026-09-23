import { describe, expect, it } from "vitest";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileDocument, type HtmlCompilerOptions } from "@motionvideo/html-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  PREVIEW_LAB_CASES,
  PREVIEW_LAB_DEFAULT_CASE,
  previewLabCaseById,
  previewLabGroups,
} from "./preview-lab";
import {
  HTML_COMPILER_TAG_LOWERING_CASES,
  HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES,
  HTML_COMPILER_OPACITY_CASES,
  HTML_COMPILER_PREVIEW_CASES,
  HTML_COMPILER_PREVIEW_FONT_ASSETS,
  HTML_COMPILER_PREVIEW_MEDIA_ASSETS,
} from "./html-compiler-preview";

const fixtureHtml = (fixture: { fixtureUrl: string }) =>
  readFileSync(join(resolve(__dirname, "../../public"), fixture.fixtureUrl.replace(/^\//, "")), "utf8");
const fixtureCss = (fixture: { fixtureUrl: string }) =>
  fixtureHtml(fixture).match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? "";
const compileFixture = (fixture: { fixtureUrl: string }, options: HtmlCompilerOptions = {}) =>
  compileDocument({ html: fixtureHtml(fixture) }, options);

describe("Protocol V2 preview lab fixtures", () => {
  it("exposes a unique current fixture set with a valid default", () => {
    const ids = PREVIEW_LAB_CASES.map((item) => item.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(PREVIEW_LAB_DEFAULT_CASE);
    expect(previewLabCaseById(null).id).toBe(PREVIEW_LAB_DEFAULT_CASE);
    expect(previewLabCaseById("does-not-exist").id).toBe(PREVIEW_LAB_DEFAULT_CASE);
  });

  it("parses and compiles every current Protocol V2 fixture", () => {
    for (const fixture of PREVIEW_LAB_CASES) {
      const project = MotionProtocolV2Schema.parse(fixture.project);
      const buffer = compileProtocolToPaintCommands(project, {
        time: fixture.previewTime ?? 0,
      });
      expect(buffer.commands[0]?.op, fixture.id).toBe("beginFrame");
      expect(buffer.commands.at(-1)?.op, fixture.id).toBe("endFrame");
    }
  });

  it("keeps current clip, mask, group, effect, media, and audio fixtures addressable", () => {
    for (const id of [
      "clip.svg.user-space",
      "mask.svg.alpha",
      "clip-mask.svg.combined",
      "group.isolation.nested",
      "effect.blur",
      "image.preserve-aspect-ratio.meet",
      "video.frame-seek",
      "audio.mix.video-plus-music",
    ]) {
      expect(previewLabCaseById(id).id).toBe(id);
    }
  });

  it("starts the HTML compiler preview without legacy fixtures", () => {
    const compilerFixtures = PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("html-compiler."));
    expect(compilerFixtures).toHaveLength(0);
  });

  it("publishes every HTML compiler fixture as a final single-file document", () => {
    expect(HTML_COMPILER_PREVIEW_CASES.length).toBeGreaterThan(0);
    for (const fixture of HTML_COMPILER_PREVIEW_CASES) {
      const html = fixtureHtml(fixture);
      expect(html, fixture.id).toMatch(/^\s*<!doctype html>/i);
      expect((html.match(/<html\b/gi) ?? []).length, fixture.id).toBe(1);
      expect((html.match(/<head(?:\s|>)/gi) ?? []).length, fixture.id).toBe(1);
      expect((html.match(/<body(?:\s|>)/gi) ?? []).length, fixture.id).toBe(1);
      expect((html.match(/<meta\b[^>]*name=["']neonix-document["']/gi) ?? []).length, fixture.id).toBe(1);
      expect(html, fixture.id).toContain('"schemaVersion":2');
      expect(html, fixture.id).toMatch(/<style\b/i);
    }
    for (const fixture of HTML_COMPILER_OPACITY_CASES) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      expect(fixtureCss(fixture), fixture.id).toContain("opacity:");
      expect(compiled.protocol?.layers.some((layer) => layer.type === "image" || layer.type === "shape" || layer.type === "group"), fixture.id).toBe(true);
    }
  });

  it("organizes current fixtures by render concept", () => {
    const groups = previewLabGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.cases.length > 0)).toBe(true);
    expect(groups.every((group) => !group.label.toLowerCase().includes("task"))).toBe(true);
  });

  it("compiles every tag-lowering fixture with the expected Protocol role", () => {
    expect(HTML_COMPILER_TAG_LOWERING_CASES).toHaveLength(8);
    const compile = (id: string) => compileFixture(
      HTML_COMPILER_TAG_LOWERING_CASES.find((item) => item.id === id)!,
      { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS },
    );

    const containers = compile("html-compiler.tags.document-shell-container");
    expect(containers.status).toBe("success");
    expect(containers.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "scene", type: "group" }),
      expect.objectContaining({ id: "card", type: "group" }),
      expect.objectContaining({ id: "fill", type: "shape" }),
    ]));

    const text = compile("html-compiler.tags.text-lowering");
    expect(text.status).toBe("success");
    expect(text.protocol?.layers.filter((layer) => layer.type === "text").map((layer) => layer.id)).toEqual(["title", "caption"]);

    const media = compile("html-compiler.tags.media-lowering");
    expect(media.status).toBe("success");
    expect(media.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "poster", type: "image" }),
      expect.objectContaining({ id: "clip", type: "video" }),
    ]));

    const audio = compile("html-compiler.tags.audio-lowering");
    expect(audio.status).toBe("success");
    expect(audio.protocol?.layers.some((layer) => layer.id === "music")).toBe(false);
    expect(audio.protocol?.audio.tracks).toEqual(expect.arrayContaining([expect.objectContaining({ id: "music" })]));

    const svg = compile("html-compiler.tags.svg-lowering");
    expect(svg.status).toBe("success");
    const svgPaths = svg.protocol?.layers.filter((layer) => layer.type === "path") ?? [];
    expect(svgPaths.map((layer) => layer.id)).toEqual(["panel", "dot", "rule", "arrow"]);
    expect(svgPaths.every((layer) => layer.transform.translate.x === 0 && layer.transform.translate.y === 0)).toBe(true);

    for (const fixture of HTML_COMPILER_TAG_LOWERING_CASES.slice(5)) {
      const compiled = compile(fixture.id);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.length, fixture.id).toBeGreaterThan(0);
    }
    const textMatrix = compile("html-compiler.tags.text-tag-matrix");
    expect(textMatrix.protocol?.layers.filter((layer) => layer.type === "text").map((layer) => layer.id)).toEqual([
      "h2", "h3", "h4", "h5", "h6", "span", "bold", "emphasis", "italic", "small", "quote", "pre", "code",
    ]);
    const svgMatrix = compile("html-compiler.tags.svg-primitive-matrix");
    expect(svgMatrix.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "nested-group", type: "group" }),
      expect.objectContaining({ id: "path", type: "path" }),
      expect.objectContaining({ id: "ellipse", type: "path" }),
      expect.objectContaining({ id: "polyline", type: "path" }),
    ]));
  });

  it("keeps text compiler and layout contracts independently observable", () => {
    const compile = (id: string) => compileFixture(
      HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES.find((item) => item.id === id)!,
      { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS },
    );

    const hardBreak = compile("html-compiler.text.compiler.br-hard-break");
    expect(hardBreak.status).toBe("success");
    expect(hardBreak.protocol?.layers.find((layer) => layer.id === "hard-break")).toMatchObject({
      type: "text",
      frame: { width: 900, height: 180 },
      payload: {
        source: { text: "Video title\nline two" },
        layout: { whiteSpace: "normal", wrap: "word", lineHeight: 86.4, hardBreaks: [11] },
      },
    });

    const nested = compile("html-compiler.text.compiler.nested-inline-content");
    expect(nested.protocol?.layers.find((layer) => layer.id === "nested-inline")).toMatchObject({
      type: "text",
      payload: {
        source: { text: "Prefix bold italic" },
        chunks: [{ spans: [
          { sourceRange: { start: 0, end: 7 }, font: { weight: 400, style: "normal" }, resolvedFontAssetIds: ["preview-font-inter-400"] },
          { sourceRange: { start: 7, end: 11 }, font: { weight: 700, style: "normal" }, resolvedFontAssetIds: ["preview-font-inter-700"] },
          { sourceRange: { start: 11, end: 12 }, font: { weight: 400, style: "normal" }, resolvedFontAssetIds: ["preview-font-inter-400"] },
          { sourceRange: { start: 12, end: 18 }, font: { weight: 400, style: "italic" }, resolvedFontAssetIds: ["preview-font-inter-400-italic"] },
        ] }],
      },
    });

    const whitespace = compile("html-compiler.text.compiler.whitespace-contract");
    expect(whitespace.protocol?.layers.find((layer) => layer.id === "normal-space")).toMatchObject({
      type: "text",
      payload: { source: { text: "A   B\nC" }, layout: { whiteSpace: "normal", wrap: "word" } },
    });
    expect(whitespace.protocol?.layers.find((layer) => layer.id === "pre-space")).toMatchObject({
      type: "text",
      payload: { source: { text: "A   B\nC" }, layout: { whiteSpace: "pre", wrap: "none" } },
    });

    const fixedLines = compile("html-compiler.text.layout.fixed-line-height");
    expect(fixedLines.protocol?.layers.find((layer) => layer.id === "fixed-lines")).toMatchObject({
      type: "text",
      frame: { width: 1000, height: 300 },
      payload: { source: { text: "Line one\nLine two\nLine three" }, layout: { lineHeight: 72 } },
    });

    const wrapped = compile("html-compiler.text.layout.wrap-width");
    expect(wrapped.protocol?.layers.find((layer) => layer.id === "wrap-width")).toMatchObject({
      type: "text",
      frame: { width: 520, height: 300 },
      payload: { layout: { sizing: "fixed", contentWidth: 520, wrap: "word" } },
    });

    const autoHeight = compile("html-compiler.text.layout.auto-height");
    const autoHeightLayer = autoHeight.protocol?.layers.find((layer) => layer.id === "auto-height");
    expect(autoHeightLayer).toMatchObject({
      type: "text",
      frame: { width: 520 },
      payload: { layout: { sizing: "fixed-width-auto-height", contentWidth: 520, wrap: "word" } },
    });
    expect(autoHeightLayer?.frame.height ?? 0).toBeGreaterThan(60);
  });

  it("keeps local preview assets under the preview public root", () => {
    const localUris = PREVIEW_LAB_CASES
      .flatMap((item) => item.project.assets)
      .map((asset) => asset.uri)
      .filter((uri) => uri.startsWith("/") && !uri.startsWith("/api/"));

    expect(localUris.length).toBeGreaterThan(0);
    expect(localUris.every((uri) => uri.startsWith("/preview/"))).toBe(true);
  });
});
