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
import { HTML_COMPILER_DEFAULT_CASE_ID, HTML_COMPILER_PAINT_PHASE2_0_CASES, HTML_COMPILER_PAINT_PHASE2_1_CASES, HTML_COMPILER_PAINT_PHASE2_2_CASES, HTML_COMPILER_PAINT_PHASE2_3_CASES, HTML_COMPILER_PAINT_PHASE2_4_CASES, HTML_COMPILER_PAINT_PHASE2_5_CASES, HTML_COMPILER_PHASE0_CASES, HTML_COMPILER_PHASE1_1_CASES, HTML_COMPILER_PHASE1_2_CASES, HTML_COMPILER_PHASE1_3_CASES, HTML_COMPILER_PHASE1_4_CASES, HTML_COMPILER_PREVIEW_FONT_ASSETS, htmlCompilerPreviewCaseById, htmlCompilerPreviewGroups } from "./html-compiler-preview";

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
    expect(HTML_COMPILER_PHASE0_CASES).toHaveLength(41);
    expect(HTML_COMPILER_PHASE1_1_CASES).toHaveLength(5);
    expect(HTML_COMPILER_PHASE1_2_CASES).toHaveLength(3);
    expect(HTML_COMPILER_PHASE1_3_CASES).toHaveLength(4);
    expect(HTML_COMPILER_PHASE1_4_CASES).toHaveLength(5);
    expect(HTML_COMPILER_PAINT_PHASE2_0_CASES).toHaveLength(4);
    expect(HTML_COMPILER_PAINT_PHASE2_1_CASES).toHaveLength(4);
    expect(HTML_COMPILER_PAINT_PHASE2_2_CASES).toHaveLength(7);
    expect(HTML_COMPILER_PAINT_PHASE2_3_CASES).toHaveLength(3);
    expect(HTML_COMPILER_PAINT_PHASE2_4_CASES).toHaveLength(3);
    expect(HTML_COMPILER_PAINT_PHASE2_5_CASES).toHaveLength(11);
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_1_CASES) {
      const compiled = compileHtmlCss(fixture.source);
      expect(compiled.status, fixture.id).toBe("success");
      const hasRepeatingPaint = compiled.protocol?.layers.some((layer) => {
        const fill = layer.style?.fill;
        return typeof fill === "object" && fill !== null && "spreadMethod" in fill && fill.spreadMethod === "repeat";
      });
      expect(hasRepeatingPaint, fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_2_CASES) {
      const compiled = compileHtmlCss(fixture.source);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.length, fixture.id).toBeGreaterThan(0);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_3_CASES) {
      const compiled = compileHtmlCss(fixture.source);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => layer.id.endsWith("::outline")), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_4_CASES) {
      const compiled = compileHtmlCss(fixture.source, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => (layer.effects?.length ?? 0) > 0), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_5_CASES) {
      const compiled = compileHtmlCss(fixture.source);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => (layer.effects?.length ?? 0) > 0), fixture.id).toBe(true);
    }
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
    expect(HTML_COMPILER_PHASE0_CASES[10]?.source.html).toContain('id="position-relative"');
    expect(HTML_COMPILER_PHASE0_CASES[10]?.source.css).toContain("position: absolute");
    expect(HTML_COMPILER_PHASE0_CASES[11]?.source.html).toContain('id="inset-frame"');
    expect(HTML_COMPILER_PHASE0_CASES[11]?.source.css).toContain("inset: 80px 120px 100px 160px");
    expect(HTML_COMPILER_PHASE0_CASES[12]?.source.html).toContain('id="display-contents"');
    expect(HTML_COMPILER_PHASE0_CASES[12]?.source.css).toContain("visibility: hidden");
    expect(HTML_COMPILER_PHASE0_CASES[13]?.source.html).toContain('id="overflow-hidden"');
    expect(HTML_COMPILER_PHASE0_CASES[13]?.source.css).toContain("opacity: 0.55");
    expect(HTML_COMPILER_PHASE0_CASES[13]?.source.css).toContain("z-index: 3");
    expect(HTML_COMPILER_PHASE0_CASES[14]?.source.html).toContain('id="transform-rotate-z"');
    expect(HTML_COMPILER_PHASE0_CASES[14]?.source.css).toContain("transform-origin: right bottom");
    expect(HTML_COMPILER_PHASE0_CASES[15]?.source.html).toContain('id="rotate-single"');
    expect(HTML_COMPILER_PHASE0_CASES[15]?.source.css).toContain("transform: rotate(17deg)");
    expect(HTML_COMPILER_PHASE0_CASES[16]?.source.html).toContain('id="paint-background-layers"');
    expect(HTML_COMPILER_PHASE0_CASES[16]?.source.css).toContain("background-color: #14b8a6");
    expect(HTML_COMPILER_PHASE0_CASES[16]?.source.css).toContain("linear-gradient");
    expect(HTML_COMPILER_PHASE0_CASES[17]?.source.html).toContain('id="paint-border-longhand"');
    expect(HTML_COMPILER_PHASE0_CASES[17]?.source.css).toContain("border: 12px solid currentColor");
    expect(HTML_COMPILER_PHASE0_CASES[17]?.source.css).toContain("border-style: none");
    expect(HTML_COMPILER_PHASE0_CASES[18]?.source.html).toContain('id="fill-rule-evenodd"');
    expect(HTML_COMPILER_PHASE0_CASES[18]?.source.css).toContain("fill-opacity: 0.72");
    expect(HTML_COMPILER_PHASE0_CASES[18]?.source.css).toContain("fill-rule: evenodd");
    expect(HTML_COMPILER_PHASE0_CASES[19]?.source.html).toContain('id="stroke-style"');
    expect(HTML_COMPILER_PHASE0_CASES[19]?.source.css).toContain("stroke-linecap: round");
    expect(HTML_COMPILER_PHASE0_CASES[20]?.source.html).toContain('id="dash-order"');
    expect(HTML_COMPILER_PHASE0_CASES[20]?.source.css).toContain("stroke-dasharray: 30px 16px");
    expect(HTML_COMPILER_PHASE0_CASES[20]?.source.css).toContain("paint-order: stroke fill");
    expect(HTML_COMPILER_PHASE0_CASES[21]?.source.html).toContain('id="linear-gradient"');
    expect(HTML_COMPILER_PHASE0_CASES[21]?.source.css).toContain("linear-gradient(90deg");
    expect(HTML_COMPILER_PHASE0_CASES[22]?.source.html).toContain('id="radial-gradient"');
    expect(HTML_COMPILER_PHASE0_CASES[22]?.source.css).toContain("radial-gradient(circle at 50% 50%");
    expect(HTML_COMPILER_PHASE0_CASES[23]?.source.html).toContain('id="conic-gradient"');
    expect(HTML_COMPILER_PHASE0_CASES[23]?.source.css).toContain("conic-gradient(from 45deg at 50% 50%");
    expect(HTML_COMPILER_PHASE0_CASES[24]?.source.html).toContain('src="/preview/image/photo-landscape.jpg"');
    expect(HTML_COMPILER_PHASE0_CASES[24]?.source.css).toContain("object-fit: contain");
    expect(HTML_COMPILER_PHASE0_CASES[25]?.source.html).toContain('src="/preview/image/photo-portrait.jpg"');
    expect(HTML_COMPILER_PHASE0_CASES[25]?.source.css).toContain("object-position: right top");
    expect(HTML_COMPILER_PHASE0_CASES[26]?.source.css).toContain("image-rendering: pixelated");
    expect(HTML_COMPILER_PHASE0_CASES[27]?.source.css).toContain("object-fit: none");
    expect(HTML_COMPILER_PHASE0_CASES[27]?.source.css).toContain("overflow: hidden");
    expect(htmlCompilerPreviewCaseById("html-compiler.typography.font-family-three-fonts").source.html).toContain('id="font-inter"');
    expect(htmlCompilerPreviewCaseById("html-compiler.typography.font-family-three-fonts").source.css).toContain('font-family: "Lora"');
    expect(htmlCompilerPreviewCaseById("html-compiler.typography.font-family-three-fonts").source.css).toContain("font-weight: 700");
    expect(htmlCompilerPreviewCaseById("html-compiler.typography.emoji-fallback").source.html).toContain('id="emoji-triple"');
    expect(htmlCompilerPreviewCaseById("html-compiler.typography.emoji-fallback").source.css).toContain('font-family: "Noto Color Emoji"');
    expect(htmlCompilerPreviewCaseById("html-compiler.typography.direction-writing-decoration").source.css).toContain("direction: rtl");
    expect(htmlCompilerPreviewCaseById("html-compiler.typography.direction-writing-decoration").source.css).toContain("writing-mode: vertical-rl");
    expect(htmlCompilerPreviewCaseById("html-compiler.typography.direction-writing-decoration").source.css).toContain("text-decoration: underline");
    expect(htmlCompilerPreviewGroups().map((group) => group.topic)).toEqual([
      "New project",
      "Composition & geometry",
      "HTML tags",
      "Cascade & values",
      "Transform 2D",
      "Paint",
      "Media",
      "Typography",
      "Layout",
      "Layout",
      "Layout",
      "Layout",
      "Paint",
      "Paint",
      "Paint",
      "Paint",
      "Paint",
      "Paint",
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

    const position = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[10]!.source);
    expect(position.status).toBe("success");
    expect(position.protocol?.layers.find((layer) => layer.id === "position-static")).toMatchObject({
      transform: { translate: { x: 80, y: 60, z: 0 } },
    });
    expect(position.protocol?.layers.find((layer) => layer.id === "position-relative")).toMatchObject({
      transform: { translate: { x: 400, y: 224, z: 0 } },
    });
    expect(position.protocol?.layers.find((layer) => layer.id === "position-absolute")).toMatchObject({
      transform: { translate: { x: 980, y: 220, z: 0 } },
    });

    const inset = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[11]!.source);
    expect(inset.status).toBe("success");
    expect(inset.protocol?.layers.find((layer) => layer.id === "inset-frame")).toMatchObject({
      frame: { width: 1160, height: 580 },
      transform: { translate: { x: 160, y: 80, z: 0 } },
    });
    expect(inset.protocol?.layers.find((layer) => layer.id === "right-bottom-box")).toMatchObject({
      frame: { width: 300, height: 160 },
      transform: { translate: { x: 980, y: 480, z: 0 } },
    });

    const displayVisibility = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[12]!.source);
    expect(displayVisibility.status).toBe("success");
    expect(displayVisibility.protocol?.layers.find((layer) => layer.id === "display-contents")).toBeUndefined();
    expect(displayVisibility.protocol?.layers.find((layer) => layer.id === "display-none")).toBeUndefined();
    expect(displayVisibility.protocol?.layers.find((layer) => layer.id === "contents-cyan")).toMatchObject({
      transform: { translate: { x: 80, y: 180, z: 0 } },
    });
    expect(displayVisibility.protocol?.layers.find((layer) => layer.id === "contents-purple")).toMatchObject({
      transform: { translate: { x: 80, y: 272, z: 0 } },
    });
    expect(displayVisibility.protocol?.layers.find((layer) => layer.id === "visibility-hidden")).toMatchObject({
      enabled: false,
      transform: { translate: { x: 1020, y: 160, z: 0 } },
    });
    const visibleLayer = displayVisibility.protocol?.layers.find((layer) => layer.id === "visibility-visible");
    expect(visibleLayer).toMatchObject({ transform: { translate: { x: 1020, y: 300, z: 0 } } });
    expect(visibleLayer).not.toHaveProperty("enabled");

    const effects = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[13]!.source);
    expect(effects.status).toBe("success");
    expect(effects.protocol?.layers.find((layer) => layer.id === "opacity-overlay")).toMatchObject({
      opacity: 0.55,
      transform: { translate: { x: 280, y: 260, z: 0 } },
    });
    const zLayers = ["z-back", "z-middle", "z-front"].map((id) => effects.protocol?.layers.find((layer) => layer.id === id));
    expect(zLayers[0]?.order).toBeLessThan(zLayers[1]?.order ?? 0);
    expect(zLayers[1]?.order).toBeLessThan(zLayers[2]?.order ?? 0);
    const hiddenOverflow = effects.protocol?.layers.find((layer) => layer.id === "overflow-hidden");
    expect(hiddenOverflow).toMatchObject({ clipPath: "html-overflow-clip-0" });
    expect(effects.protocol?.clipPaths).toEqual([
      expect.objectContaining({
        id: "html-overflow-clip-0",
        children: [expect.objectContaining({ type: "rect", x: 0, y: 0, width: 300, height: 160 })],
      }),
    ]);
    expect(effects.protocol?.layers.find((layer) => layer.id === "overflow-visible")).not.toHaveProperty("clipPath");

    const transforms = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[14]!.source);
    expect(transforms.status).toBe("success");
    expect(transforms.protocol?.layers.find((layer) => layer.id === "transform-translate")).toMatchObject({
      transform: {
        translate: { x: 120, y: 180, z: 0 },
        operations: [{ type: "translate", x: 40, y: 24 }],
      },
    });
    expect(transforms.protocol?.layers.find((layer) => layer.id === "transform-scale")).toMatchObject({
      transform: {
        scale: { x: 1.2, y: 0.75, z: 1 },
        anchor: { x: 110, y: 60, z: 0 },
      },
    });
    expect(transforms.protocol?.layers.find((layer) => layer.id === "transform-rotate-z")).toMatchObject({
      transform: { operations: [{ type: "extension", name: "motion.rotateZ", value: -12 }] },
    });
    expect(transforms.protocol?.layers.find((layer) => layer.id === "transform-skew-y")).toMatchObject({
      transform: { operations: [{ type: "skewY", angle: 10 }] },
    });

    const singleRotate = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[15]!.source);
    expect(singleRotate.status).toBe("success");
    expect(singleRotate.protocol?.layers).toHaveLength(1);
    expect(singleRotate.protocol?.layers[0]).toMatchObject({
      id: "rotate-single",
      type: "shape",
      frame: { width: 320, height: 180 },
      transform: {
        translate: { x: 800, y: 420, z: 0 },
        anchor: { x: 160, y: 90, z: 0 },
        operations: [{ type: "rotate", angle: 17 }],
      },
      style: { fill: "#38bdf8" },
    });

    const paint = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[16]!.source);
    expect(paint.status).toBe("success");
    expect(paint.protocol?.layers.find((layer) => layer.id === "paint-background-color")).toMatchObject({
      style: { fill: "#14b8a6" },
    });
    expect(paint.protocol?.layers.find((layer) => layer.id === "paint-background-solid")).toMatchObject({
      style: { fill: "#a78bfa" },
    });
    const paintLayers = paint.protocol?.layers.filter((layer) => layer.id.startsWith("paint-background-layers::paint:")) ?? [];
    expect(paintLayers).toHaveLength(2);
    expect(paintLayers[0]?.style.fill).toMatchObject({ type: "linear-gradient", angle: 0 });
    expect(paintLayers[1]?.style.fill).toBe("#172554");
    expect(paintLayers[0]?.order).toBeGreaterThan(paintLayers[1]?.order ?? Number.POSITIVE_INFINITY);

    const colorBorder = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[17]!.source);
    expect(colorBorder.status).toBe("success");
    expect(colorBorder.protocol?.layers.find((layer) => layer.id === "paint-color-border::paint")).toMatchObject({
      frame: { width: 444, height: 244 },
      payload: { cornerRadius: 28 },
      style: { fill: "#172554" },
    });
    expect(colorBorder.protocol?.layers.find((layer) => layer.id === "paint-color-border::border")).toMatchObject({
      frame: { width: 432, height: 232 },
      transform: { translate: { x: 6, y: 6, z: 0 } },
      style: { stroke: "#38bdf8", strokeWidth: 12 },
    });
    expect(colorBorder.protocol?.layers.find((layer) => layer.id === "paint-border-longhand::paint")).toMatchObject({
      frame: { width: 436, height: 236 },
      payload: { cornerRadius: 28 },
      style: { fill: "#172554" },
    });
    expect(colorBorder.protocol?.layers.find((layer) => layer.id === "paint-border-longhand::border")).toMatchObject({
      frame: { width: 428, height: 228 },
      transform: { translate: { x: 4, y: 4, z: 0 } },
      style: { stroke: "#facc15", strokeWidth: 8 },
    });
    expect(colorBorder.protocol?.layers.find((layer) => layer.id === "paint-border-none")).not.toHaveProperty("style.stroke");

    const fill = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[18]!.source);
    expect(fill.status).toBe("success");
    expect(fill.protocol?.layers.find((layer) => layer.id === "fill-rule-evenodd")).toMatchObject({
      type: "path",
      payload: { fillRule: "evenodd", contours: [{ id: "contour-0" }, { id: "contour-1" }] },
      style: { fill: "#38bdf8", fillOpacity: 0.72 },
    });

    const stroke = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[19]!.source);
    expect(stroke.status).toBe("success");
    expect(stroke.protocol?.layers.find((layer) => layer.id === "stroke-style")).toMatchObject({
      type: "path",
      style: { stroke: "#facc15", strokeWidth: 28, strokeOpacity: 0.82, strokeJoin: "bevel", strokeCap: "round" },
    });

    const dashOrder = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[20]!.source);
    expect(dashOrder.status).toBe("success");
    expect(dashOrder.protocol?.layers.find((layer) => layer.id === "dash-order")).toMatchObject({
      type: "path",
      style: {
        strokeDash: { array: [30, 16], offset: 12 },
        paintOrder: ["stroke", "fill"],
      },
    });

    const linearGradient = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[21]!.source);
    expect(linearGradient.status).toBe("success");
    expect(linearGradient.protocol?.layers.find((layer) => layer.id === "linear-gradient")).toMatchObject({
      style: { fill: { type: "linear-gradient", angle: 0, stops: [{ offset: 0 }, { offset: 0.5 }, { offset: 1 }] } },
    });

    const radialGradient = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[22]!.source);
    expect(radialGradient.status).toBe("success");
    expect(radialGradient.protocol?.layers.find((layer) => layer.id === "radial-gradient")).toMatchObject({
      style: { fill: { type: "radial-gradient", cx: 0.5, cy: 0.5, radius: expect.closeTo(Math.sqrt(5) / 2, 6), stops: [{ offset: 0 }, { offset: 0.42 }, { offset: 1 }] } },
    });

    const conicGradient = compileHtmlCss(HTML_COMPILER_PHASE0_CASES[23]!.source);
    expect(conicGradient.status).toBe("success");
    expect(conicGradient.protocol?.layers.find((layer) => layer.id === "conic-gradient")).toMatchObject({
      style: { fill: { type: "conic-gradient", from: 45, cx: 0.5, cy: 0.5, stops: [{ offset: 0 }, { offset: 0.33 }, { offset: 0.66 }, { offset: 1 }] } },
    });

    const mediaCases = HTML_COMPILER_PHASE0_CASES.slice(24);
    const mediaResults = mediaCases.slice(0, 4).map((fixture) => compileHtmlCss(fixture.source));
    expect(mediaResults.every((result) => result.status === "success")).toBe(true);
    expect(mediaResults[0]?.protocol?.layers.find((layer) => layer.id === "media-contain")).toMatchObject({
      type: "image",
      payload: { fit: "contain", preserveAspectRatio: { align: "xMidYMid", meetOrSlice: "meet" } },
    });
    expect(mediaResults[1]?.protocol?.layers.find((layer) => layer.id === "media-cover")).toMatchObject({
      type: "image",
      payload: { fit: "cover", preserveAspectRatio: { align: "xMaxYMin", meetOrSlice: "slice" } },
    });
    expect(mediaResults[2]?.protocol?.layers.find((layer) => layer.id === "media-fill")).toMatchObject({
      type: "image",
      payload: { fit: "fill", preserveAspectRatio: { align: "none" }, imageRendering: "pixelated" },
    });
    expect(mediaResults[3]?.protocol?.layers.find((layer) => layer.id === "media-none-viewport")).toMatchObject({
      type: "group",
      clipPath: "html-overflow-clip-0",
    });
    expect(mediaResults[3]?.protocol?.layers.find((layer) => layer.id === "media-none")).toMatchObject({
      type: "image",
      payload: { fit: "none", preserveAspectRatio: { align: "xMidYMid" } },
    });

    const typographyCase = (id: string) => htmlCompilerPreviewCaseById(id)!;
    const typographyResult = (id: string) => compileHtmlCss(typographyCase(id).source, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
    const typographyResults = [
      "html-compiler.typography.text-align-values",
      "html-compiler.typography.text-spacing-whitespace",
      "html-compiler.typography.direction-writing-decoration",
      "html-compiler.typography.font-family-three-fonts",
      "html-compiler.typography.emoji-fallback",
      "html-compiler.typography.weight-fallback",
      "html-compiler.typography.family-fallback",
      "html-compiler.typography.style-stretch",
      "html-compiler.typography.line-height-short",
      "html-compiler.typography.line-height-normal",
      "html-compiler.typography.line-height-long",
      "html-compiler.typography.text-overflow-ellipsis",
      "html-compiler.typography.text-rendering-capability",
    ].map(typographyResult);
    expect(typographyResults.every((result) => result.status === "success")).toBe(true);
    const fontFamilyResult = typographyResult("html-compiler.typography.font-family-three-fonts");
    const emojiResult = typographyResult("html-compiler.typography.emoji-fallback");
    const spacingResult = typographyResult("html-compiler.typography.text-spacing-whitespace");
    const directionWritingDecorationResult = typographyResult("html-compiler.typography.direction-writing-decoration");
    const interLayer = fontFamilyResult.protocol?.layers.find((layer) => layer.id === "font-inter");
    expect(interLayer).toMatchObject({ id: "font-inter", type: "text", payload: { source: { text: "Inter — precise interface" } } });
    expect(interLayer && interLayer.type === "text" ? interLayer.payload.chunks[0]?.spans[0]?.font : undefined).toMatchObject({ families: ["Inter", "sans-serif"], size: 72, weight: 400 });
    expect(fontFamilyResult.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "font-lora", type: "text" }),
      expect.objectContaining({ id: "font-roboto", type: "text" }),
    ]));
    expect(emojiResult.protocol?.layers.find((layer) => layer.id === "emoji-single")).toMatchObject({ id: "emoji-single", type: "text", payload: { source: { text: "😀" } } });
    expect(emojiResult.protocol?.layers.find((layer) => layer.id === "emoji-text")).toMatchObject({ id: "emoji-text", type: "text", payload: { source: { text: "Neonix 🚀" } } });
    expect(emojiResult.protocol?.layers.find((layer) => layer.id === "emoji-triple")).toMatchObject({ id: "emoji-triple", type: "text", payload: { source: { text: "🚀 🎬 ✨" } } });
    expect(emojiResult.protocol?.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "preview-font-noto-color-emoji", kind: "font", weight: 400 }),
    ]));
    const letterSpacingLayer = spacingResult.protocol?.layers.find((layer) => layer.id === "spacing-letter");
    expect(letterSpacingLayer).toMatchObject({
      type: "text",
      payload: {
        layout: { whiteSpace: "normal", wrap: "word" },
        chunks: [{ spans: [{ letterSpacing: { value: 8, unit: "px" } }] }],
      },
    });
    const wordSpacingLayer = spacingResult.protocol?.layers.find((layer) => layer.id === "spacing-word");
    expect(wordSpacingLayer).toMatchObject({
      type: "text",
      payload: { chunks: [{ spans: [{ wordSpacing: { value: 28, unit: "px" } }] }] },
    });
    expect(spacingResult.protocol?.layers.find((layer) => layer.id === "whitespace-normal")).toMatchObject({ type: "text", payload: { layout: { whiteSpace: "normal", wrap: "word" } } });
    expect(spacingResult.protocol?.layers.find((layer) => layer.id === "whitespace-nowrap")).toMatchObject({ type: "text", payload: { layout: { whiteSpace: "nowrap", wrap: "none" } } });
    expect(spacingResult.protocol?.layers.find((layer) => layer.id === "whitespace-pre")).toMatchObject({ type: "text", payload: { layout: { whiteSpace: "pre", wrap: "none" } } });
    expect(spacingResult.protocol?.layers.find((layer) => layer.id === "whitespace-pre-wrap")).toMatchObject({ type: "text", payload: { layout: { whiteSpace: "pre-wrap", wrap: "word" } } });
    expect(spacingResult.protocol?.layers.find((layer) => layer.id === "whitespace-pre-line")).toMatchObject({ type: "text", payload: { layout: { whiteSpace: "pre-line", wrap: "word" } } });
    expect(spacingResult.protocol?.layers.find((layer) => layer.id === "whitespace-break-spaces")).toMatchObject({ type: "text", payload: { layout: { whiteSpace: "break-spaces", wrap: "word" } } });

    expect(directionWritingDecorationResult.protocol?.layers.find((layer) => layer.id === "direction-rtl")).toMatchObject({ type: "text", payload: { source: { direction: "rtl", writingMode: "horizontal-tb" }, chunks: [{ textAnchor: "end" }] } });
    expect(directionWritingDecorationResult.protocol?.layers.find((layer) => layer.id === "writing-vertical-rl")).toMatchObject({ type: "text", payload: { source: { direction: "ltr", writingMode: "vertical-rl" } } });
    expect(directionWritingDecorationResult.protocol?.layers.find((layer) => layer.id === "writing-vertical-lr")).toMatchObject({ type: "text", payload: { source: { direction: "ltr", writingMode: "vertical-lr" } } });
    expect(directionWritingDecorationResult.protocol?.layers.find((layer) => layer.id === "decoration-all")).toMatchObject({
      type: "text",
      payload: { chunks: [{ spans: [{ textDecoration: { underline: { fill: "#f97316", strokeWidth: { value: 3, unit: "px" } }, overline: { fill: "#f97316", strokeWidth: { value: 3, unit: "px" } }, lineThrough: { fill: "#f97316", strokeWidth: { value: 3, unit: "px" } } } }] }] },
    });

    const weightFallback = typographyResult("html-compiler.typography.weight-fallback").protocol?.layers.find((layer) => layer.id === "weight-fallback");
    expect(weightFallback && weightFallback.type === "text" ? weightFallback.payload.chunks[0]?.spans[0]?.resolvedFontAssetIds : undefined).toEqual(["preview-font-inter-bold"]);
    const familyFallback = typographyResult("html-compiler.typography.family-fallback").protocol?.layers.find((layer) => layer.id === "family-fallback");
    expect(familyFallback && familyFallback.type === "text" ? familyFallback.payload.chunks[0]?.spans[0]?.resolvedFontAssetIds : undefined).toEqual(["preview-font-inter-regular"]);
    const styleResult = typographyResult("html-compiler.typography.style-stretch");
    const styleItalic = styleResult.protocol?.layers.find((layer) => layer.id === "style-italic");
    expect(styleItalic && styleItalic.type === "text" ? styleItalic.payload.chunks[0]?.spans[0] : undefined).toMatchObject({
      resolvedFontAssetIds: ["preview-font-inter-italic"],
      font: { style: "italic", stretch: "normal" },
    });
    const styleCondensed = styleResult.protocol?.layers.find((layer) => layer.id === "style-condensed-regular");
    expect(styleCondensed && styleCondensed.type === "text" ? styleCondensed.payload.chunks[0]?.spans[0] : undefined).toMatchObject({
      resolvedFontAssetIds: ["preview-font-roboto-condensed-regular"],
      font: { style: "normal", stretch: "condensed" },
    });
    const styleCondensedBold = styleResult.protocol?.layers.find((layer) => layer.id === "style-condensed-bold");
    expect(styleCondensedBold && styleCondensedBold.type === "text" ? styleCondensedBold.payload.chunks[0]?.spans[0] : undefined).toMatchObject({
      resolvedFontAssetIds: ["preview-font-roboto-condensed-bold"],
      font: { weight: 700, style: "normal", stretch: "condensed" },
    });
    expect(typographyResult("html-compiler.typography.line-height-short").protocol?.layers.find((layer) => layer.id === "line-height-short")).toMatchObject({
      type: "text",
      payload: { layout: { lineHeight: 64 } },
    });
    const normalLineHeight = typographyResult("html-compiler.typography.line-height-normal").protocol?.layers.find((layer) => layer.id === "line-height-normal");
    expect(normalLineHeight && normalLineHeight.type === "text" ? normalLineHeight.payload.layout?.lineHeight : undefined).toBeCloseTo(57.6, 6);
    expect(typographyResult("html-compiler.typography.line-height-long").protocol?.layers.find((layer) => layer.id === "line-height-long")).toMatchObject({
      type: "text",
      payload: { layout: { lineHeight: 70 } },
    });

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
    expect(group.protocol?.layers.find((layer) => layer.id === "card-background")).toMatchObject({
      transform: { translate: { x: 40, y: 40 } },
    });
    expect(group.protocol?.layers.find((layer) => layer.id === "card-accent")).toMatchObject({
      transform: { translate: { x: 40, y: 40 } },
    });

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
