import { describe, expect, it } from "vitest";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import { compileHtmlCss } from "@motionvideo/html-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  PREVIEW_LAB_CASES,
  PREVIEW_LAB_DEFAULT_CASE,
  previewLabCaseById,
  previewLabGroups,
} from "./preview-lab";
import { HTML_COMPILER_DEFAULT_CASE_ID, HTML_COMPILER_PHASE0_CASES, htmlCompilerPreviewCaseById, htmlCompilerPreviewGroups } from "./html-compiler-preview";

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

  it("keeps the HTML compiler sidebar backed by real P0 fixtures", () => {
    expect(HTML_COMPILER_PHASE0_CASES).toHaveLength(10);
    expect(htmlCompilerPreviewCaseById(null).id).toBe(HTML_COMPILER_DEFAULT_CASE_ID);
    expect(HTML_COMPILER_PHASE0_CASES[0]?.id).toBe("html-compiler.new-project.blue-rectangle");
    expect(HTML_COMPILER_PHASE0_CASES[0]?.source.composition).toEqual({
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#081018",
      colorSpace: "srgb",
    });
    expect(HTML_COMPILER_PHASE0_CASES[0]?.source.html).toContain("blue-rectangle");
    expect(HTML_COMPILER_PHASE0_CASES[0]?.source.css).toContain("#2563eb");
    const compiled = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[0]!.source);
    expect(compiled.status).toBe("success");
    expect(compiled.protocol?.composition).toMatchObject({ width: 1920, height: 1080, fps: 30, background: "#081018", colorSpace: "srgb" });
    expect(compiled.protocol?.formatVersion).toBe(2);
    expect(compiled.protocol?.layers.length).toBeGreaterThan(0);
    expect(compiled.protocol?.layers[0]).toMatchObject({
      id: "blue-rectangle",
      type: "shape",
      frame: { width: 480, height: 240 },
      transform: { translate: { x: 720, y: 420, z: 0 } },
      style: { fill: "#2563eb" },
    });
    expect(HTML_COMPILER_PHASE0_CASES[1]?.source.html).toContain('id="explicit-size"');
    expect(HTML_COMPILER_PHASE0_CASES[1]?.source.css).toContain("width: 640px");
    expect(HTML_COMPILER_PHASE0_CASES[2]?.source.html).toContain('id="size-constraints"');
    expect(HTML_COMPILER_PHASE0_CASES[2]?.source.css).toContain("max-width: 320px");
    expect(HTML_COMPILER_PHASE0_CASES[3]?.source.html).toContain('id="green-shape"');
    expect(HTML_COMPILER_PHASE0_CASES[4]?.source.html).toContain('id="card"');
    expect(HTML_COMPILER_PHASE0_CASES[5]?.source.html).toContain('id="logo-mark"');
    expect(HTML_COMPILER_PHASE0_CASES[5]?.source.css).toContain("stroke-width: 8px");
    expect(HTML_COMPILER_PHASE0_CASES[6]?.source.html).toContain('id="card"');
    expect(HTML_COMPILER_PHASE0_CASES[6]?.source.css).toContain("!important");
    expect(HTML_COMPILER_PHASE0_CASES[7]?.source.html).toContain('id="content-ratio"');
    expect(HTML_COMPILER_PHASE0_CASES[7]?.source.css).toContain("aspect-ratio: 16 / 9");
    expect(HTML_COMPILER_PHASE0_CASES[8]?.source.css).toContain("margin: 8px 20px 16px");
    expect(HTML_COMPILER_PHASE0_CASES[8]?.source.css).toContain("margin-left: 34px");
    expect(HTML_COMPILER_PHASE0_CASES[9]?.source.css).toContain("padding: 12px 28px");
    expect(HTML_COMPILER_PHASE0_CASES[9]?.source.css).toContain("padding-left: 34px");
    expect(htmlCompilerPreviewGroups().map((group) => group.topic)).toEqual([
      "New project",
      "Composition & geometry",
      "HTML tags",
      "Cascade & values",
    ]);
    expect(htmlCompilerPreviewGroups().every((group) => group.cases.length > 0)).toBe(true);

    const explicitSize = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[1]!.source);
    expect(explicitSize.status).toBe("success");
    expect(explicitSize.protocol?.layers[0]).toMatchObject({
      id: "explicit-size",
      frame: { width: 640, height: 360 },
      transform: { translate: { x: 640, y: 360, z: 0 } },
    });

    const constraints = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[2]!.source);
    expect(constraints.status).toBe("success");
    expect(constraints.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "min-width-case", frame: { width: 280, height: 120 } }),
      expect.objectContaining({ id: "max-width-case", frame: { width: 320, height: 120 } }),
      expect.objectContaining({ id: "min-height-case", frame: { width: 320, height: 120 } }),
      expect.objectContaining({ id: "max-height-case", frame: { width: 320, height: 120 } }),
    ]));

    const shape = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[3]!.source);
    expect(shape.status).toBe("success");
    expect(shape.protocol?.layers[0]).toMatchObject({
      id: "green-shape",
      type: "shape",
      style: { fill: "#22c55e" },
    });

    const group = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[4]!.source);
    expect(group.status).toBe("success");
    expect(group.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "card", type: "group" }),
      expect.objectContaining({ id: "card-background", parentLayerId: "card", type: "shape" }),
      expect.objectContaining({ id: "card-accent", parentLayerId: "card", type: "shape" }),
    ]));

    const path = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[5]!.source);
    expect(path.status).toBe("success");
    expect(path.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "logo", type: "group" }),
      expect.objectContaining({ id: "logo-mark", parentLayerId: "logo", type: "path" }),
    ]));

    const aspectBoxSizing = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[7]!.source);
    expect(aspectBoxSizing.status).toBe("success");
    expect(aspectBoxSizing.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "content-ratio", frame: { width: 688, height: 408 } }),
      expect.objectContaining({ id: "border-ratio", frame: { width: 640, height: 360 } }),
    ]));

    const margin = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[8]!.source);
    expect(margin.status).toBe("success");
    expect(margin.protocol?.layers.find((layer) => layer.id === "margin-all")).toMatchObject({ frame: { width: 260, height: 100 }, transform: { translate: { x: 24, y: 24, z: 0 } } });
    expect(margin.protocol?.layers.find((layer) => layer.id === "margin-yx")).toMatchObject({ transform: { translate: { x: 28, y: 148, z: 0 } } });
    expect(margin.protocol?.layers.find((layer) => layer.id === "margin-three")).toMatchObject({ transform: { translate: { x: 20, y: 260, z: 0 } } });
    expect(margin.protocol?.layers.find((layer) => layer.id === "margin-longhands")).toMatchObject({ transform: { translate: { x: 34, y: 376, z: 0 } } });

    const padding = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[9]!.source);
    expect(padding.status).toBe("success");
    expect(padding.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "padding-all", frame: { width: 312, height: 172 } }),
      expect.objectContaining({ id: "padding-yx", frame: { width: 320, height: 148 } }),
      expect.objectContaining({ id: "padding-three", frame: { width: 304, height: 148 } }),
      expect.objectContaining({ id: "padding-longhands", frame: { width: 316, height: 156 } }),
    ]));
  });

  it("organizes current fixtures by render concept", () => {
    const groups = previewLabGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.cases.length > 0)).toBe(true);
    expect(groups.every((group) => !group.label.toLowerCase().includes("task"))).toBe(true);
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
