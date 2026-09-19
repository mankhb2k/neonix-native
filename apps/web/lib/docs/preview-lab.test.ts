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
import { HTML_COMPILER_TAG_LOWERING_CASES, HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES, HTML_COMPILER_ANCHOR_CASES, HTML_COMPILER_DEFAULT_CASE_ID, HTML_COMPILER_LAYOUT_TEXT_CASES, HTML_COMPILER_MOTION_PHASE3_CASES, HTML_COMPILER_OPACITY_CASES, HTML_COMPILER_PAINT_PHASE2_0_CASES, HTML_COMPILER_PAINT_PHASE2_1_CASES, HTML_COMPILER_PAINT_PHASE2_2_CASES, HTML_COMPILER_PAINT_PHASE2_3_CASES, HTML_COMPILER_PAINT_PHASE2_4_CASES, HTML_COMPILER_PAINT_PHASE2_5_CASES, HTML_COMPILER_PAINT_PHASE2_6_CASES, HTML_COMPILER_PAINT_PHASE2_7_CASES, HTML_COMPILER_PAINT_PHASE2_8_CASES, HTML_COMPILER_PHASE0_CASES, HTML_COMPILER_PHASE1_1_CASES, HTML_COMPILER_PHASE1_2_CASES, HTML_COMPILER_PHASE1_3_CASES, HTML_COMPILER_PHASE1_4_CASES, HTML_COMPILER_PERSPECTIVE_PHASE5_CASES, HTML_COMPILER_PERSPECTIVE_PHASE6_CASES, HTML_COMPILER_PERSPECTIVE_PHASE7_CASES, HTML_COMPILER_PERSPECTIVE_PHASE9_CASES, HTML_COMPILER_PREVIEW_CASES, HTML_COMPILER_PREVIEW_FONT_ASSETS, HTML_COMPILER_PREVIEW_MEDIA_ASSETS, htmlCompilerPreviewCaseById, htmlCompilerPreviewGroups } from "./html-compiler-preview";

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

  it("keeps the HTML compiler sidebar backed by the primitive fixture catalog", () => {
    expect(HTML_COMPILER_PHASE0_CASES).toHaveLength(41);
    expect(HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES).toHaveLength(6);
    expect(HTML_COMPILER_PHASE1_1_CASES).toHaveLength(5);
    expect(HTML_COMPILER_PHASE1_2_CASES).toHaveLength(3);
    expect(HTML_COMPILER_PHASE1_3_CASES).toHaveLength(4);
    expect(HTML_COMPILER_PHASE1_4_CASES).toHaveLength(5);
    expect(HTML_COMPILER_LAYOUT_TEXT_CASES).toHaveLength(10);
    expect(HTML_COMPILER_ANCHOR_CASES).toHaveLength(1);
    expect(HTML_COMPILER_PAINT_PHASE2_0_CASES).toHaveLength(7);
    expect(HTML_COMPILER_OPACITY_CASES).toHaveLength(3);
    expect(HTML_COMPILER_PAINT_PHASE2_1_CASES).toHaveLength(4);
    expect(HTML_COMPILER_PAINT_PHASE2_2_CASES).toHaveLength(11);
    expect(HTML_COMPILER_PAINT_PHASE2_3_CASES).toHaveLength(3);
    expect(HTML_COMPILER_PAINT_PHASE2_4_CASES).toHaveLength(6);
    expect(HTML_COMPILER_PAINT_PHASE2_5_CASES).toHaveLength(14);
    expect(HTML_COMPILER_PAINT_PHASE2_6_CASES).toHaveLength(5);
    expect(HTML_COMPILER_PAINT_PHASE2_7_CASES).toHaveLength(8);
    expect(HTML_COMPILER_PAINT_PHASE2_8_CASES).toHaveLength(5);
    expect(HTML_COMPILER_MOTION_PHASE3_CASES).toHaveLength(46);
    expect(HTML_COMPILER_PERSPECTIVE_PHASE5_CASES).toHaveLength(13);
    expect(HTML_COMPILER_PERSPECTIVE_PHASE6_CASES).toHaveLength(11);
    expect(HTML_COMPILER_PERSPECTIVE_PHASE7_CASES).toHaveLength(12);
    expect(HTML_COMPILER_PERSPECTIVE_PHASE9_CASES.every((fixture) => fixture.classification === "combined")).toBe(true);
    const groups = htmlCompilerPreviewGroups();
    expect(groups.map((group) => group.category)).toEqual([
      "HTML tag lowering",
      "Text compiler & layout",
      "Layout primitives",
      "Paint primitives",
      "Effect primitives",
      "Transform & 3D primitives",
      "Typography & media primitives",
      "Animation & keyframe primitives",
      "Combined pipeline cases",
    ]);
    expect(groups.every((group) => group.cases.every((fixture) => fixture.category === group.category))).toBe(true);
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_1_CASES) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      const hasRepeatingPaint = compiled.protocol?.layers.some((layer) => {
        const fill = layer.style?.fill;
        return typeof fill === "object" && fill !== null && "spreadMethod" in fill && fill.spreadMethod === "repeat";
      });
      expect(hasRepeatingPaint, fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_LAYOUT_TEXT_CASES) {
      const compiled = compileFixture(fixture, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => layer.type === "text" && layer.frame.width > 0 && layer.frame.height > 0), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_2_CASES) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.length, fixture.id).toBeGreaterThan(0);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_7_CASES) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => layer.clipPath), fixture.id).toBe(true);
      expect(compiled.protocol?.clipPaths?.length, fixture.id).toBeGreaterThan(0);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_3_CASES) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => layer.id.endsWith("::outline")), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_4_CASES) {
      const compiled = compileFixture(fixture, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => (layer.effects?.length ?? 0) > 0), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_5_CASES) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => (layer.effects?.length ?? 0) > 0), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_6_CASES) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => layer.composite !== undefined), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PAINT_PHASE2_8_CASES) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => (layer.maskLayers?.length ?? 0) > 0), fixture.id).toBe(true);
      expect(compiled.protocol?.masks?.length, fixture.id).toBeGreaterThan(0);
    }
    for (const fixture of HTML_COMPILER_MOTION_PHASE3_CASES) {
      const compiled = compileFixture(fixture, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
      if (fixture.id === "html-compiler.motion.keyframes-unknown-name") {
        expect(compiled.status, fixture.id).toBe("error");
        expect(compiled.diagnostics[0]?.code, fixture.id).toBe("css-animation-name-unknown");
      } else if (fixture.id === "html-compiler.motion.easing-invalid") {
        expect(compiled.status, fixture.id).toBe("error");
        expect(compiled.diagnostics[0]?.code, fixture.id).toBe("css-animation-easing-invalid");
      } else {
        expect(compiled.status, fixture.id).toBe("success");
        expect(compiled.protocol?.layers.some((layer) => (layer.tracks?.length ?? 0) > 0), fixture.id).toBe(true);
      }
    }
    for (const fixture of HTML_COMPILER_PERSPECTIVE_PHASE5_CASES) {
      const compiled = compileFixture(fixture, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.length, fixture.id).toBeGreaterThan(0);
      expect(compiled.protocol?.layers.some((layer) => (layer.type === "group" && layer.render3d !== undefined) || layer.transform.operations?.some((operation) => operation.type === "extension" && (operation.name === "motion.perspective" || operation.name === "motion.translate3d" || operation.name === "motion.rotateX" || operation.name === "motion.rotateY"))), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_PERSPECTIVE_PHASE7_CASES) {
      const compiled = compileFixture(fixture, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
      expect(compiled.status, fixture.id).toBe("success");
      const tracks = compiled.protocol?.layers.flatMap((layer) => layer.tracks ?? []) ?? [];
      expect(tracks.length, fixture.id).toBeGreaterThan(0);
      if (fixture.properties.includes("perspective-origin")) {
        expect(tracks.some((track) => track.path === "render3d.perspective.origin"), fixture.id).toBe(true);
      } else {
        expect(tracks.some((track) => track.path === "render3d.perspective.distance"), fixture.id).toBe(true);
      }
    }
    for (const fixture of HTML_COMPILER_MOTION_PHASE3_CASES.filter((item) => item.id.includes("delay") || item.id.includes("fill-") || item.id.includes("play-state"))) {
      const compiled = compileFixture(fixture, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
      expect(compiled.status, fixture.id).toBe("success");
      const animation = compiled.protocol?.layers.flatMap((layer) => layer.tracks ?? []).map((track) => track.animation).find(Boolean);
      expect(animation, fixture.id).toMatchObject({ durationMs: expect.any(Number), fillMode: expect.any(String), playState: expect.any(String) });
    }
    for (const fixture of HTML_COMPILER_MOTION_PHASE3_CASES.filter((item) => item.id.includes("combo-"))) {
      const compiled = compileFixture(fixture, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => (layer.tracks?.length ?? 0) > 0), fixture.id).toBe(true);
    }
    for (const fixture of HTML_COMPILER_MOTION_PHASE3_CASES.filter((item) => item.id.includes("motion-path"))) {
      const compiled = compileFixture(fixture);
      expect(compiled.status, fixture.id).toBe("success");
      expect(compiled.protocol?.layers.some((layer) => layer.motion?.offsetPath.type === "path"), fixture.id).toBe(true);
      expect(compiled.protocol?.layers.flatMap((layer) => layer.tracks ?? []).some((track) => track.path === "motion.offsetDistance"), fixture.id).toBe(true);
    }
    const borderCombo = compileFixture(HTML_COMPILER_MOTION_PHASE3_CASES.find((item) => item.id === "html-compiler.motion.combo-border-paint")!);
    expect(borderCombo.status).toBe("success");
    expect(borderCombo.protocol?.layers.find((layer) => layer.id.endsWith("::border"))?.tracks?.map((track) => track.path)).toEqual(expect.arrayContaining(["style.stroke", "style.strokeWidth"]));
    const isolateCombo = compileFixture(HTML_COMPILER_MOTION_PHASE3_CASES.find((item) => item.id === "html-compiler.motion.combo-isolated-blend")!);
    expect(isolateCombo.protocol?.layers.some((layer) => layer.composite?.isolation === "isolate")).toBe(true);
    expect(isolateCombo.protocol?.layers.some((layer) => layer.composite?.blendMode === "multiply")).toBe(true);
    const clipCombo = compileFixture(HTML_COMPILER_MOTION_PHASE3_CASES.find((item) => item.id === "html-compiler.motion.combo-clip-path")!);
    expect(clipCombo.protocol?.layers.some((layer) => layer.clipPath !== undefined)).toBe(true);
    const imageCombo = compileFixture(HTML_COMPILER_MOTION_PHASE3_CASES.find((item) => item.id === "html-compiler.motion.combo-image-clipping")!);
    expect(imageCombo.protocol?.layers.some((layer) => layer.type === "image")).toBe(true);
    expect(imageCombo.protocol?.layers.some((layer) => layer.clipPath !== undefined)).toBe(true);
    expect(htmlCompilerPreviewCaseById(null).id).toBe(HTML_COMPILER_DEFAULT_CASE_ID);
    expect(HTML_COMPILER_PHASE0_CASES[0]?.id).toBe("html-compiler.new-project.blue-rectangle");
    expect(HTML_COMPILER_PHASE0_CASES[0]?.composition).toEqual({
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#081018",
      colorSpace: "srgb",
    });
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[0]!)).toContain("blue-rectangle");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[0]!)).toContain("#2563eb");
    const compiled = compileFixture(HTML_COMPILER_PHASE0_CASES[0]!);
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
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[1]!)).toContain('id="explicit-size"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[1]!)).toContain("width: 640px");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[2]!)).toContain('id="size-constraints"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[2]!)).toContain("max-width: 320px");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[3]!)).toContain('id="green-shape"');
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[4]!)).toContain('id="card"');
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[5]!)).toContain('id="logo-mark"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[5]!)).toContain("stroke-width: 8px");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[6]!)).toContain('id="card"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[6]!)).toContain("!important");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[7]!)).toContain('id="content-ratio"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[7]!)).toContain("aspect-ratio: 16 / 9");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[8]!)).toContain("margin: 8px 20px 16px");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[8]!)).toContain("margin-left: 34px");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[9]!)).toContain("padding: 12px 28px");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[9]!)).toContain("padding-left: 34px");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[10]!)).toContain('id="position-relative"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[10]!)).toContain("position: absolute");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[11]!)).toContain('id="inset-frame"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[11]!)).toContain("inset: 80px 120px 100px 160px");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[12]!)).toContain('id="display-contents"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[12]!)).toContain("visibility: hidden");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[13]!)).toContain('id="overflow-hidden"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[13]!)).toContain("opacity: 0.55");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[13]!)).toContain("z-index: 3");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[14]!)).toContain('id="transform-rotate-z"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[14]!)).toContain("transform-origin: right bottom");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[15]!)).toContain('id="rotate-single"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[15]!)).toContain("transform: rotate(17deg)");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[16]!)).toContain('id="paint-background-layers"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[16]!)).toContain("background-color: #14b8a6");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[16]!)).toContain("linear-gradient");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[17]!)).toContain('id="paint-border-longhand"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[17]!)).toContain("border: 12px solid currentColor");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[17]!)).toContain("border-style: none");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[18]!)).toContain('id="fill-rule-evenodd"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[18]!)).toContain("fill-opacity: 0.72");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[18]!)).toContain("fill-rule: evenodd");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[19]!)).toContain('id="stroke-style"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[19]!)).toContain("stroke-linecap: round");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[20]!)).toContain('id="dash-order"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[20]!)).toContain("stroke-dasharray: 30px 16px");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[20]!)).toContain("paint-order: stroke fill");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[21]!)).toContain('id="linear-gradient"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[21]!)).toContain("linear-gradient(90deg");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[22]!)).toContain('id="radial-gradient"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[22]!)).toContain("radial-gradient(circle at 50% 50%");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[23]!)).toContain('id="conic-gradient"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[23]!)).toContain("conic-gradient(from 45deg at 50% 50%");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[24]!)).toContain('src="/preview/image/photo-landscape.jpg"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[24]!)).toContain("object-fit: contain");
    expect(fixtureHtml(HTML_COMPILER_PHASE0_CASES[25]!)).toContain('src="/preview/image/photo-portrait.jpg"');
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[25]!)).toContain("object-position: right top");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[26]!)).toContain("image-rendering: pixelated");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[27]!)).toContain("object-fit: none");
    expect(fixtureCss(HTML_COMPILER_PHASE0_CASES[27]!)).toContain("overflow: hidden");
    expect(fixtureHtml(htmlCompilerPreviewCaseById("html-compiler.typography.font-family-three-fonts"))).toContain('id="font-inter"');
    expect(fixtureCss(htmlCompilerPreviewCaseById("html-compiler.typography.font-family-three-fonts"))).toContain('font-family: "Lora"');
    expect(fixtureCss(htmlCompilerPreviewCaseById("html-compiler.typography.font-family-three-fonts"))).toContain("font-weight: 700");
    expect(fixtureHtml(htmlCompilerPreviewCaseById("html-compiler.typography.emoji-fallback"))).toContain('id="emoji-triple"');
    expect(fixtureCss(htmlCompilerPreviewCaseById("html-compiler.typography.emoji-fallback"))).toContain('font-family: "Noto Color Emoji"');
    expect(fixtureCss(htmlCompilerPreviewCaseById("html-compiler.typography.direction-writing-decoration"))).toContain("direction: rtl");
    expect(fixtureCss(htmlCompilerPreviewCaseById("html-compiler.typography.direction-writing-decoration"))).toContain("writing-mode: vertical-rl");
    expect(fixtureCss(htmlCompilerPreviewCaseById("html-compiler.typography.direction-writing-decoration"))).toContain("text-decoration: underline");
    expect(htmlCompilerPreviewGroups().map((group) => group.category)).toEqual([
      "HTML tag lowering",
      "Text compiler & layout",
      "Layout primitives",
      "Paint primitives",
      "Effect primitives",
      "Transform & 3D primitives",
      "Typography & media primitives",
      "Animation & keyframe primitives",
      "Combined pipeline cases",
    ]);
    expect(htmlCompilerPreviewGroups().every((group) => group.cases.length > 0)).toBe(true);

    const explicitSize = compileFixture(HTML_COMPILER_PHASE0_CASES[1]!);
    expect(explicitSize.status).toBe("success");
    expect(explicitSize.protocol?.layers[0]).toMatchObject({
      id: "explicit-size",
      frame: { width: 640, height: 360 },
      transform: { translate: { x: 640, y: 360, z: 0 } },
    });

    const constraints = compileFixture(HTML_COMPILER_PHASE0_CASES[2]!);
    expect(constraints.status).toBe("success");
    expect(constraints.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "min-width-case", frame: { width: 280, height: 120 } }),
      expect.objectContaining({ id: "max-width-case", frame: { width: 320, height: 120 } }),
      expect.objectContaining({ id: "min-height-case", frame: { width: 320, height: 120 } }),
      expect.objectContaining({ id: "max-height-case", frame: { width: 320, height: 120 } }),
    ]));

    const position = compileFixture(HTML_COMPILER_PHASE0_CASES[10]!);
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

    const inset = compileFixture(HTML_COMPILER_PHASE0_CASES[11]!);
    expect(inset.status).toBe("success");
    expect(inset.protocol?.layers.find((layer) => layer.id === "inset-frame")).toMatchObject({
      frame: { width: 1160, height: 580 },
      transform: { translate: { x: 160, y: 80, z: 0 } },
    });
    expect(inset.protocol?.layers.find((layer) => layer.id === "right-bottom-box")).toMatchObject({
      frame: { width: 300, height: 160 },
      transform: { translate: { x: 980, y: 480, z: 0 } },
    });

    const displayVisibility = compileFixture(HTML_COMPILER_PHASE0_CASES[12]!);
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

    const effects = compileFixture(HTML_COMPILER_PHASE0_CASES[13]!);
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

    const transforms = compileFixture(HTML_COMPILER_PHASE0_CASES[14]!);
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

    const singleRotate = compileFixture(HTML_COMPILER_PHASE0_CASES[15]!);
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

    const paint = compileFixture(HTML_COMPILER_PHASE0_CASES[16]!);
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

    const colorBorder = compileFixture(HTML_COMPILER_PHASE0_CASES[17]!);
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

    const fill = compileFixture(HTML_COMPILER_PHASE0_CASES[18]!);
    expect(fill.status).toBe("success");
    expect(fill.protocol?.layers.find((layer) => layer.id === "fill-rule-evenodd")).toMatchObject({
      type: "path",
      payload: { fillRule: "evenodd", contours: [{ id: "contour-0" }, { id: "contour-1" }] },
      style: { fill: "#38bdf8", fillOpacity: 0.72 },
    });

    const stroke = compileFixture(HTML_COMPILER_PHASE0_CASES[19]!);
    expect(stroke.status).toBe("success");
    expect(stroke.protocol?.layers.find((layer) => layer.id === "stroke-style")).toMatchObject({
      type: "path",
      style: { stroke: "#facc15", strokeWidth: 28, strokeOpacity: 0.82, strokeJoin: "bevel", strokeCap: "round" },
    });

    const dashOrder = compileFixture(HTML_COMPILER_PHASE0_CASES[20]!);
    expect(dashOrder.status).toBe("success");
    expect(dashOrder.protocol?.layers.find((layer) => layer.id === "dash-order")).toMatchObject({
      type: "path",
      style: {
        strokeDash: { array: [30, 16], offset: 12 },
        paintOrder: ["stroke", "fill"],
      },
    });

    const linearGradient = compileFixture(HTML_COMPILER_PHASE0_CASES[21]!);
    expect(linearGradient.status).toBe("success");
    expect(linearGradient.protocol?.layers.find((layer) => layer.id === "linear-gradient")).toMatchObject({
      style: { fill: { type: "linear-gradient", angle: 0, stops: [{ offset: 0 }, { offset: 0.5 }, { offset: 1 }] } },
    });

    const radialGradient = compileFixture(HTML_COMPILER_PHASE0_CASES[22]!);
    expect(radialGradient.status).toBe("success");
    expect(radialGradient.protocol?.layers.find((layer) => layer.id === "radial-gradient")).toMatchObject({
      style: { fill: { type: "radial-gradient", cx: 0.5, cy: 0.5, radius: expect.closeTo(Math.sqrt(5) / 2, 6), stops: [{ offset: 0 }, { offset: 0.42 }, { offset: 1 }] } },
    });

    const conicGradient = compileFixture(HTML_COMPILER_PHASE0_CASES[23]!);
    expect(conicGradient.status).toBe("success");
    expect(conicGradient.protocol?.layers.find((layer) => layer.id === "conic-gradient")).toMatchObject({
      style: { fill: { type: "conic-gradient", from: 45, cx: 0.5, cy: 0.5, stops: [{ offset: 0 }, { offset: 0.33 }, { offset: 0.66 }, { offset: 1 }] } },
    });

    const mediaCases = HTML_COMPILER_PHASE0_CASES.slice(24);
    const mediaResults = mediaCases.slice(0, 4).map((fixture) => compileFixture(fixture));
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
    const typographyResult = (id: string) => compileFixture(typographyCase(id), { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS });
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

    const shape = compileFixture(HTML_COMPILER_PHASE0_CASES[3]!);
    expect(shape.status).toBe("success");
    expect(shape.protocol?.layers[0]).toMatchObject({
      id: "green-shape",
      type: "shape",
      style: { fill: "#22c55e" },
    });

    const group = compileFixture(HTML_COMPILER_PHASE0_CASES[4]!);
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

    const path = compileFixture(HTML_COMPILER_PHASE0_CASES[5]!);
    expect(path.status).toBe("success");
    expect(path.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "logo", type: "group" }),
      expect.objectContaining({ id: "logo-mark", parentLayerId: "logo", type: "path" }),
    ]));

    const aspectBoxSizing = compileFixture(HTML_COMPILER_PHASE0_CASES[7]!);
    expect(aspectBoxSizing.status).toBe("success");
    expect(aspectBoxSizing.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "content-ratio", frame: { width: 688, height: 408 } }),
      expect.objectContaining({ id: "border-ratio", frame: { width: 640, height: 360 } }),
    ]));

    const margin = compileFixture(HTML_COMPILER_PHASE0_CASES[8]!);
    expect(margin.status).toBe("success");
    expect(margin.protocol?.layers.find((layer) => layer.id === "margin-all")).toMatchObject({ frame: { width: 260, height: 100 }, transform: { translate: { x: 24, y: 24, z: 0 } } });
    expect(margin.protocol?.layers.find((layer) => layer.id === "margin-yx")).toMatchObject({ transform: { translate: { x: 28, y: 148, z: 0 } } });
    expect(margin.protocol?.layers.find((layer) => layer.id === "margin-three")).toMatchObject({ transform: { translate: { x: 20, y: 260, z: 0 } } });
    expect(margin.protocol?.layers.find((layer) => layer.id === "margin-longhands")).toMatchObject({ transform: { translate: { x: 34, y: 376, z: 0 } } });

    const padding = compileFixture(HTML_COMPILER_PHASE0_CASES[9]!);
    expect(padding.status).toBe("success");
    expect(padding.protocol?.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "padding-all", frame: { width: 312, height: 172 } }),
      expect.objectContaining({ id: "padding-yx", frame: { width: 320, height: 148 } }),
      expect.objectContaining({ id: "padding-three", frame: { width: 304, height: 148 } }),
      expect.objectContaining({ id: "padding-longhands", frame: { width: 316, height: 156 } }),
    ]));
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
          { sourceRange: { start: 0, end: 7 }, font: { weight: 400, style: "normal" }, resolvedFontAssetIds: ["preview-font-inter-regular"] },
          { sourceRange: { start: 7, end: 11 }, font: { weight: 700, style: "normal" }, resolvedFontAssetIds: ["preview-font-inter-bold"] },
          { sourceRange: { start: 11, end: 12 }, font: { weight: 400, style: "normal" }, resolvedFontAssetIds: ["preview-font-inter-regular"] },
          { sourceRange: { start: 12, end: 18 }, font: { weight: 400, style: "italic" }, resolvedFontAssetIds: ["preview-font-inter-italic"] },
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
