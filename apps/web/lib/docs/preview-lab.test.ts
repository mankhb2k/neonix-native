import { describe, expect, it } from "vitest";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  PREVIEW_LAB_CASES,
  PREVIEW_LAB_DEFAULT_CASE,
  previewLabCaseById,
  previewLabGroups,
} from "./preview-lab";

describe("Protocol V2 preview lab fixtures", () => {
  it("contains the certified rectangle atom and its Task 3 property fixtures", () => {
    expect(PREVIEW_LAB_CASES.map((item) => item.id)).toEqual([
      "primitive.shape.rectangle",
      "primitive.shape.ellipse",
      "html-compiler.primitives.rectangle-rounded",
      "html-compiler.transform.translate",
      "html-compiler.transform.scale-anchor",
      "html-compiler.transform.rotate",
      "html-compiler.transform.skew",
      "html-compiler.path.svg-cubic",
      "html-compiler.path.svg-evenodd",
      "html-compiler.path.svg-stroke",
      "html-compiler.phase2.cascade",
      "html-compiler.phase2.units-calc",
      "html-compiler.phase2.normalization",
      "html-compiler.phase2.tags",
      "html-compiler.phase2.diagnostics",
      "html-compiler.phase3.block-flow",
      "html-compiler.phase3.positioning",
      "html-compiler.phase3.visibility-z-index",
      "html-compiler.phase4.rounded-border",
      "html-compiler.phase4.linear-gradient",
      "html-compiler.phase4.radial-gradient",
      "html-compiler.phase4.conic-gradient",
      "html-compiler.phase4.background-layers",
      "image.fit.contain",
      "image.fit.cover",
      "image.crop",
      "image.missing-asset",
      "composite.blend.normal",
      "composite.blend.multiply",
      "composite.blend.screen",
      "composite.blend.stack.normal",
      "composite.blend.stack.multiply",
      "composite.blend.stack.screen",
      "video.frame-seek",
      "video.trim",
      "video.frame-policy",
      "video.multi-instance",
      "text.single-line.alignment",
      "text.left.alignment",
      "text.right.alignment",
      "text.paragraph.multiline",
      "effect.color-adjust",
      "effect.blur",
      "effect.blur.stroke",
      "effect.drop-shadow",
      "effect.drop-shadow.negative-offset",
      "effect.drop-shadow.zero-blur",
      "effect.drop-shadow.alpha-color",
      "effect.drop-shadow.stroke-source",
      "effect.outer-glow",
      "effect.outer-glow.stroke-source",
      "effect.inner-glow",
      "effect.outer-glow.perspective",
      "effect.noise",
      "effect.order",
      "effect.blur-chain",
      "effect.blur.radius-4",
      "effect.blur.radius-40",
      "effect.blur.radius-256",
      "path.closed-fill.perspective",
      "path.cubic-fill",
      "path.fill-rule.nonzero",
      "path.fill-rule.evenodd",
      "path.multiple-contours.donut",
      "path.paint.stroke",
      "path.paint.stroke-cap-dash",
      "path.morph",
      "group.parent-transform",
      "group.isolation.opacity",
      "group.isolation.nested",
      "composite.mask.nested",
      "composite.mask.clip",
      "composite.mask.alpha",
      "composite.mask.inverse-alpha",
      "composite.mask.luma",
      "rectangle.paint.stroke",
      "rectangle.paint.stroke-perspective",
      "ellipse.paint.stroke",
      "ellipse.paint.stroke-perspective",
      "rectangle.paint.stroke-width",
      "rectangle.paint.stroke-width-perspective",
      "rectangle.paint.opacity",
      "rectangle.paint.opacity-perspective",
      "rectangle.rounded",
      "rectangle.rounded-perspective",
      "rectangle.gradient.linear",
      "ellipse.gradient.radial",
      "rectangle.gradient.perspective",
      "rectangle.transform.translate",
      "rectangle.transform.scale",
      "rectangle.transform.anchor",
      "rectangle.transform.rotate",
      "rectangle.mat4.anchor-outside-rotate-z",
      "rectangle.mat4.anchor-z-rotate-y-perspective",
      "rectangle.transform.skew",
      "rectangle.transform.operations.translate-rotate",
      "rectangle.transform.operations.rotate-translate",
      "rectangle.transform.operations.rotate-x",
      "rectangle.transform.operations.rotate-y",
      "rectangle.transform.operations.rotate-z",
      "rectangle.transform.operations.skew",
      "rectangle.transform.scale-z",
      "rectangle.transform.operations.perspective",
      "rectangle.transform.operations.matrix",
      "rectangle.mat4.rotate-x-perspective",
      "rectangle.mat4.rotate-y-perspective",
      "rectangle.mat4.translate-z-perspective",
      "rectangle.timing",
      "rectangle.opacity",
      "rectangle.order",
      "audio.asset",
      "audio.timing",
      "audio.trim",
      "audio.gain",
      "audio.pan",
      "audio.fade",
      "audio.track.mute",
      "audio.track.overlap",
      "audio.video-source",
      "audio.mix.two-tracks",
      "audio.mix.video-plus-music",
    ]);
    expect(PREVIEW_LAB_DEFAULT_CASE).toBe("primitive.shape.rectangle");
    expect(previewLabCaseById(null).id).toBe(PREVIEW_LAB_DEFAULT_CASE);
  });

  it("parses and compiles every V2 fixture without V1", () => {
    for (const fixture of PREVIEW_LAB_CASES) {
      const project = MotionProtocolV2Schema.parse(fixture.project);
      const buffer = compileProtocolToPaintCommands(project, {
        time: fixture.previewTime ?? 0,
      });
      expect(buffer.commands[0]?.op).toBe("beginFrame");
      expect(buffer.commands.at(-1)?.op).toBe("endFrame");
    }
  });

  it("exposes dedicated HTML compiler Phase 2 source/protocol previews", () => {
    const cases = PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("html-compiler.phase2."));
    expect(cases).toHaveLength(5);
    for (const fixture of cases) {
      expect(fixture.htmlCssSource?.html).toBeTruthy();
      expect(fixture.htmlCssSource?.css).toBeTruthy();
      expect(fixture.project.formatVersion).toBe(2);
      expect(fixture.project.layers.length).toBeGreaterThan(0);
    }
    const phase3 = PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("html-compiler.phase3."));
    expect(phase3).toHaveLength(3);
    const phase4 = PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("html-compiler.phase4."));
    expect(phase4).toHaveLength(5);
    for (const fixture of phase4) {
      expect(fixture.htmlCssSource?.html).toBeTruthy();
      expect(fixture.htmlCssSource?.css).toBeTruthy();
      expect(fixture.project.formatVersion).toBe(2);
    }
    const diagnostics = previewLabCaseById("html-compiler.phase2.diagnostics");
    expect(diagnostics.htmlCssSource).toBeDefined();
  });

  it("covers solid and rounded primitives with one HTML compiler fixture", () => {
    const fixture = previewLabCaseById("html-compiler.primitives.rectangle-rounded");
    expect(fixture.group).toBe("Primitives");
    expect(fixture.htmlCssSource?.html).toContain('id="compiler-solid"');
    expect(fixture.htmlCssSource?.html).toContain('id="compiler-rounded"');
    expect(fixture.project.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "compiler-solid", type: "shape", style: { fill: "#14b8a6" } }),
      expect.objectContaining({ id: "compiler-rounded", type: "shape", payload: expect.objectContaining({ cornerRadius: 48 }), style: expect.objectContaining({ stroke: "#e2e8f0", strokeWidth: 12 }) }),
    ]));
  });

  it("exposes HTML compiler transform fixtures in the existing Transforms & 3D group", () => {
    const transforms = PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("html-compiler.transform."));
    expect(transforms).toHaveLength(4);
    expect(transforms.every((fixture) => fixture.group === "Transforms & 3D")).toBe(true);
    expect(transforms.map((fixture) => fixture.project.layers[0]?.transform.operations?.[0]?.type)).toEqual([
      "translate", "scale", "rotateZ", "skew",
    ]);
  });

  it("exposes one HTML compiler preview for each supported path source", () => {
    const cases = PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("html-compiler.path."));
    expect(cases).toHaveLength(3);
    expect(cases.every((fixture) => fixture.group === "Paths" && fixture.htmlCssSource?.html.includes("<svg"))).toBe(true);
    expect(cases.map((fixture) => fixture.project.layers.find((layer) => layer.type === "path")?.type)).toEqual(["path", "path", "path"]);
    const stroke = cases.find((fixture) => fixture.id.endsWith("svg-stroke"))?.project.layers.find((layer) => layer.type === "path");
    expect(stroke).toMatchObject({ style: { stroke: "#f97316", strokeWidth: 20, strokeOpacity: 0.9, strokeJoin: "bevel", strokeCap: "round", strokeDash: { array: [64, 24], offset: 8 } } });
  });

  it("includes JSON fixtures for every canonical transform operation", () => {
    const translateRotate = previewLabCaseById("rectangle.transform.operations.translate-rotate");
    const rotateTranslate = previewLabCaseById("rectangle.transform.operations.rotate-translate");
    expect(translateRotate.project.layers[0]?.transform.operations?.map((operation) => operation.type)).toEqual(["translate", "rotateZ"]);
    expect(rotateTranslate.project.layers[0]?.transform.operations?.map((operation) => operation.type)).toEqual(["rotateZ", "translate"]);
    expect(previewLabCaseById("rectangle.transform.operations.rotate-x").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "rotateX", value: 28 });
    expect(previewLabCaseById("rectangle.transform.operations.rotate-y").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "rotateY", value: 28 });
    expect(previewLabCaseById("rectangle.transform.operations.rotate-z").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "rotateZ", value: 28 });
    expect(previewLabCaseById("rectangle.transform.operations.skew").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "skew", value: { x: 18, y: -12 } });
    expect(previewLabCaseById("rectangle.transform.scale-z").project.layers[0]?.transform.scale.z).toBe(1.5);
    expect(previewLabCaseById("rectangle.transform.operations.perspective").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "perspective", value: 800 });
    expect(previewLabCaseById("rectangle.transform.operations.matrix").project.layers[0]?.transform.operations?.[0].type).toBe("matrix");
  });

  it("includes a JSON preview for cubic path geometry", () => {
    const fixture = previewLabCaseById("path.cubic-fill");
    const layer = fixture.project.layers[0];
    expect(layer?.type).toBe("path");
    expect(layer?.type === "path" && layer.payload.contours[0]?.segments.some((segment) => segment.kind === "cubic")).toBe(true);
  });

  it("includes explicit two-track mix examples for docs preview", () => {
    const twoTracks = previewLabCaseById("audio.mix.two-tracks");
    const videoPlusMusic = previewLabCaseById("audio.mix.video-plus-music");
    expect(twoTracks.project.audio.tracks.map((track) => track.id)).toEqual(["dialogue", "music"]);
    expect(videoPlusMusic.project.audio.tracks.map((track) => track.id)).toEqual(["video-audio", "music"]);
    expect(videoPlusMusic.project.audio.tracks.flatMap((track) => track.clips).map((clip) => clip.assetId)).toContain("example-video-audio-source");
    expect(videoPlusMusic.project.audio.tracks.flatMap((track) => track.clips).map((clip) => clip.assetId)).toContain("music-mbb-island-tropical");
  });

  it("organizes the sidebar by render concept instead of implementation task", () => {
    const groups = previewLabGroups();
    expect(groups.map((group) => group.label)).toEqual([
      "Primitives",
      "HTML compiler / Phase 2",
      "HTML compiler / Phase 3",
      "Primitives / rounded",
      "Transforms & 3D",
      "Groups",
      "Paths",
      "Paint / strokes",
      "Paint / gradients",
      "Paint / opacity",
      "Images",
      "Video",
      "Audio",
      "Text",
      "Timing",
      "Effects",
      "Compositing / blend modes",
      "Compositing / masks & isolation",
      "Compositing",
    ]);
    expect(groups.every((group) => !group.label.toLowerCase().includes("task"))).toBe(true);
  });

  it("assigns image-stack blend ownership only to the upper snow layer", () => {
    const fixture = previewLabCaseById("composite.blend.stack.screen");
    expect(fixture.project.layers).toMatchObject([
      {
        id: "blend-stack-base-image",
        order: 0,
        payload: { assetId: "preview-image-v2" },
      },
      {
        id: "blend-stack-snow-screen",
        order: 1,
        composite: { blendMode: "screen" },
        payload: { assetId: "preview-snow-v2" },
      },
    ]);
    expect(fixture.project.layers[0]).not.toHaveProperty("composite");
  });

  it("keeps the clip source structural and mask-only inside its group", () => {
    const fixture = previewLabCaseById("composite.mask.clip");
    expect(fixture.project.layers).toMatchObject([
      {
        id: "clip-mask-group",
        type: "group",
        composite: {
          masks: [{ mode: "clip", sourceLayerId: "clip-mask-ellipse", sourceVisibility: "mask-only", composite: "add" }],
        },
      },
      { id: "clip-mask-ellipse", parentLayerId: "clip-mask-group", type: "shape" },
      { id: "clip-mask-content", parentLayerId: "clip-mask-group", type: "image" },
    ]);
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "clip-mask-group",
      isolation: true,
      offscreen: true,
      compositeAlpha: 1,
      mask: { mode: "clip", sourceKey: "clip-mask-ellipse", sourceVisibility: "mask-only" },
    }));
  });

  it("preserves source alpha for an alpha mask", () => {
    const fixture = previewLabCaseById("composite.mask.alpha");
    expect(fixture.project.layers[0]).toMatchObject({
      id: "alpha-mask-group",
      composite: { masks: [{ mode: "alpha", sourceLayerId: "alpha-mask-ellipse", sourceVisibility: "mask-only", composite: "add" }] },
    });
    expect(fixture.project.layers[1]).toMatchObject({
      id: "alpha-mask-ellipse",
      style: { fillOpacity: 0.45 },
    });
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "alpha-mask-group",
      mask: { mode: "alpha", sourceKey: "alpha-mask-ellipse", sourceVisibility: "mask-only" },
    }));
  });

  it("inverts a mask-only source alpha without exposing the source", () => {
    const fixture = previewLabCaseById("composite.mask.inverse-alpha");
    expect(fixture.project.layers[0]).toMatchObject({
      id: "inverse-alpha-mask-group",
      composite: { masks: [{ mode: "inverse-alpha", sourceLayerId: "inverse-alpha-mask-ellipse", sourceVisibility: "mask-only", composite: "add" }] },
    });
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "inverse-alpha-mask-group",
      mask: { mode: "inverse-alpha", sourceKey: "inverse-alpha-mask-ellipse", sourceVisibility: "mask-only" },
    }));
  });

  it("uses source luminance as mask coverage", () => {
    const fixture = previewLabCaseById("composite.mask.luma");
    expect(fixture.project.layers[0]).toMatchObject({
      id: "luma-mask-group",
      composite: { masks: [{ mode: "luma", sourceLayerId: "luma-mask-ellipse", sourceVisibility: "mask-only", composite: "add" }] },
    });
    expect(fixture.project.layers[1]).toMatchObject({ style: { fill: "#808080" } });
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "luma-mask-group",
      mask: { mode: "luma", sourceKey: "luma-mask-ellipse", sourceVisibility: "mask-only" },
    }));
  });

  it("keeps nested isolation scopes balanced in runtime paint commands", () => {
    const fixture = previewLabCaseById("group.isolation.nested");
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands.filter((command) => command.op === "beginLayer")).toEqual([
      expect.objectContaining({ key: "nested-outer-group", isolation: true, offscreen: true, compositeAlpha: 0.75 }),
      expect.objectContaining({ key: "nested-inner-group", isolation: true, offscreen: true, compositeAlpha: 0.5 }),
    ]);
    expect(buffer.commands.filter((command) => command.op === "endLayer")).toEqual([
      { op: "endLayer", key: "nested-inner-group" },
      { op: "endLayer", key: "nested-outer-group" },
    ]);
  });

  it("embeds a mask group inside an outer isolation scope", () => {
    const fixture = previewLabCaseById("composite.mask.nested");
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "nested-mask-outer-group",
      isolation: true,
      offscreen: true,
      compositeAlpha: 0.75,
    }));
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "nested-mask-inner-group",
      isolation: true,
      offscreen: true,
      compositeAlpha: 1,
      mask: { mode: "alpha", sourceKey: "nested-mask-ellipse", sourceVisibility: "mask-only" },
    }));
  });
});
