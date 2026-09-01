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
  it("contains the Protocol V2 preview fixtures", () => {
    expect(PREVIEW_LAB_CASES.map((item) => item.id)).toEqual([
      "primitive.shape.rectangle",
      "primitive.shape.ellipse",
      "shape.circle",
      "shape.line",
      "shape.polyline",
      "shape.polyline-fill",
      "shape.polygon",
      "shape.corner-radius",
      "shape.rectangle-rx",
      "shape.rectangle-ry",
      "shape.rectangle-rx-ry",
      "shape.solid-fill",
      "shape.linear-gradient",
      "shape.radial-gradient",
      "shape.radial-focus",
      "shape.gradient-many-stops",
      "shape.conic-gradient",
      "shape.gradient-spread",
      "shape.gradient-user-space",
      "shape.pattern",
      "shape.pattern-group",
      "shape.fill-opacity",
      "shape.stroke",
      "shape.stroke-width",
      "shape.stroke-opacity",
      "shape.paint-order.fill-stroke",
      "shape.paint-order.stroke-fill",
      "shape.stroke-join",
      "shape.stroke-cap",
      "shape.stroke-dash",
      "shape.stroke-gradient",
      "shape.stroke-miter-limit",
      "shape.effects",
      "shape.rectangle-perspective",
      "shape.ellipse-perspective",
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
      "image.preserve-aspect-ratio.meet",
      "image.preserve-aspect-ratio.slice",
      "image.preserve-aspect-ratio.none",
      "image.preserve-aspect-ratio.alignment",
      "image.image-rendering.pixelated",
      "image.nested-svg",
      "image.missing-asset",
      "composite.blend.normal",
      "composite.blend.darken",
      "composite.blend.multiply",
      "composite.blend.color-burn",
      "composite.blend.lighten",
      "composite.blend.screen",
      "composite.blend.color-dodge",
      "composite.blend.overlay",
      "composite.blend.soft-light",
      "composite.blend.hard-light",
      "composite.blend.difference",
      "composite.blend.exclusion",
      "composite.blend.hue",
      "composite.blend.saturation",
      "composite.blend.color",
      "composite.blend.luminosity",
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
      "path.geometry.line",
      "path.geometry.cubic",
      "path.geometry.quadratic",
      "path.geometry.arc",
      "path.geometry.arc-closed",
      "path.geometry.closed-contour",
      "path.geometry.open-contour",
      "path.geometry.multiple-contours",
      "path.fill",
      "path.gradient",
      "path.pattern",
      "path.fill-opacity",
      "path.stroke",
      "path.stroke-width",
      "path.stroke-opacity",
      "path.paint-order.fill-stroke",
      "path.paint-order.stroke-fill",
      "path.marker-start",
      "path.marker-mid",
      "path.marker-end",
      "path.marker-start-mid-end",
      "shape.marker-end",
      "path.stroke-join.miter",
      "path.stroke-join.bevel",
      "path.stroke-join.round",
      "path.stroke-cap.butt",
      "path.stroke-cap.square",
      "path.stroke-cap.round",
      "path.stroke-dash",
      "path.stroke-dash-offset",
      "path.effects",
      "path.morph",
      "group.basic",
      "group.parent-transform",
      "group.nested-transform",
      "group.explicit-isolation",
      "group.disabled",
      "group.visibility.hidden",
      "group.timing",
      "group.effects",
      "group.isolation.opacity",
      "group.isolation.nested",
      "composite.blend.group.multiply",
      "composite.blend.group.screen",
      "clip.svg.user-space",
      "clip.svg.object-bounding-box",
      "mask.svg.alpha",
      "mask.svg.luminance",
      "clip-mask.svg.combined",
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
      "rectangle.transform.operations.matrix4",
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

  it("lowers every Shape fixture to a Runtime drawPath command", () => {
    for (const fixture of PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("shape."))) {
      const buffer = compileProtocolToPaintCommands(fixture.project, { time: fixture.previewTime ?? 0 });
      const path = buffer.commands.find((command) => command.op === "drawPath");
      expect(path, fixture.id).toBeDefined();
      expect(path?.op === "drawPath" && path.contours).toHaveLength(1);
    }

    const openFilledPolyline = compileProtocolToPaintCommands(
      previewLabCaseById("shape.polyline-fill").project,
      { time: 0 },
    ).commands.find((command) => command.op === "drawPath");
    expect(openFilledPolyline?.op === "drawPath" && openFilledPolyline.mesh).toBeDefined();
  });

  it("lowers marker references into ordered marker draw passes", () => {
    const start = compileProtocolToPaintCommands(previewLabCaseById("path.marker-start").project, { time: 0 });
    const mid = compileProtocolToPaintCommands(previewLabCaseById("path.marker-mid").project, { time: 0 });
    const all = compileProtocolToPaintCommands(previewLabCaseById("path.marker-start-mid-end").project, { time: 0 });
    const startPaths = start.commands.filter((command) => command.op === "drawPath");
    const midPaths = mid.commands.filter((command) => command.op === "drawPath");
    const allPaths = all.commands.filter((command) => command.op === "drawPath");
    expect(startPaths).toHaveLength(2);
    expect(midPaths).toHaveLength(5);
    expect(allPaths).toHaveLength(5);
    expect(allPaths.at(-1)?.op === "drawPath" && allPaths.at(-1)?.paintOrder).toEqual(["fill"]);
    expect(start.commands.some((command) => command.key?.includes(":marker:end:"))).toBe(true);
  });

  it("lowers semantic SVG clipPath and mask definitions into mask surfaces", () => {
    for (const id of [
      "clip.svg.user-space",
      "clip.svg.object-bounding-box",
      "mask.svg.alpha",
      "mask.svg.luminance",
    ]) {
      const buffer = compileProtocolToPaintCommands(previewLabCaseById(id).project, { time: 0 });
      const layer = buffer.commands.find((command) => command.op === "beginLayer");
      const coverageLength = id.startsWith("clip.svg.")
        ? layer?.op === "beginLayer" && layer.clipPath?.sourceKeys?.length
        : layer?.op === "beginLayer" && layer.mask?.sourceKeys?.length;
      expect(coverageLength, id).toBeGreaterThan(0);
      expect(buffer.commands.some((command) => command.key?.includes(":clipPath:") || command.key?.includes(":mask:"))).toBe(true);
    }
  });

  it("lowers combined clipPath and mask into separate coverage inputs", () => {
    const buffer = compileProtocolToPaintCommands(previewLabCaseById("clip-mask.svg.combined").project, { time: 0 });
    const layer = buffer.commands.find((command) => command.op === "beginLayer");
    expect(layer?.op === "beginLayer" && layer.clipPath?.sourceKeys?.length).toBeGreaterThan(0);
    expect(layer?.op === "beginLayer" && layer.mask?.sourceKeys?.length).toBeGreaterThan(0);
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
    const diagnostics = previewLabCaseById("html-compiler.phase2.diagnostics", "html-compiler");
    expect(diagnostics.htmlCssSource).toBeDefined();
  });

  it("covers solid and rounded primitives with one HTML compiler fixture", () => {
    const fixture = previewLabCaseById("html-compiler.primitives.rectangle-rounded", "html-compiler");
    expect(fixture.group).toBe("Primitives");
    expect(fixture.htmlCssSource?.html).toContain('id="compiler-solid"');
    expect(fixture.htmlCssSource?.html).toContain('id="compiler-rounded"');
    expect(fixture.project.layers).toEqual(expect.arrayContaining([
      // Vitest's matcher API is intentionally untyped.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ id: "compiler-solid", type: "shape", style: { fill: "#14b8a6" } }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ id: "compiler-rounded", type: "shape", payload: expect.objectContaining({ cornerRadius: 48 }), style: expect.objectContaining({ stroke: "#e2e8f0", strokeWidth: 12 }) }),
    ]));
  });

  it("exposes HTML compiler transform fixtures in the existing Transforms & 3D group", () => {
    const transforms = PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("html-compiler.transform."));
    expect(transforms).toHaveLength(4);
    expect(transforms.every((fixture) => fixture.group === "Transforms & 3D")).toBe(true);
    expect(transforms.map((fixture) => fixture.project.layers[0]?.transform.operations?.[0]?.type)).toEqual([
      "translate", "scale", "rotate", "skewX",
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
    expect(translateRotate.project.layers[0]?.transform.operations?.map((operation) => operation.type)).toEqual(["translate", "rotate"]);
    expect(rotateTranslate.project.layers[0]?.transform.operations?.map((operation) => operation.type)).toEqual(["rotate", "translate"]);
    expect(previewLabCaseById("rectangle.transform.operations.rotate-x").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "extension", name: "motion.rotateX", value: 28 });
    expect(previewLabCaseById("rectangle.transform.operations.rotate-y").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "extension", name: "motion.rotateY", value: 28 });
    expect(previewLabCaseById("rectangle.transform.operations.rotate-z").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "extension", name: "motion.rotateZ", value: 28 });
    expect(previewLabCaseById("rectangle.transform.operations.skew").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "skewX", angle: 18 });
    expect(previewLabCaseById("rectangle.transform.scale-z").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "extension", name: "motion.scale3d", value: { x: 1.2, y: 0.8, z: 1.5 } });
    expect(previewLabCaseById("rectangle.transform.operations.perspective").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "extension", name: "motion.perspective", value: 800 });
    expect(previewLabCaseById("rectangle.transform.operations.matrix").project.layers[0]?.transform.operations?.[0]).toEqual({ type: "matrix", values: [1, 0, 0, 1, 720, 440] });
    expect(previewLabCaseById("rectangle.transform.operations.matrix4").project.layers[0]?.transform.operations?.[0]).toEqual(expect.objectContaining({ type: "extension", name: "motion.matrix4" }));
  });

  it("represents shape stroke width with the required stroke color", () => {
    const fixture = previewLabCaseById("shape.stroke-width");
    const layer = fixture.project.layers[0];
    expect(layer).toMatchObject({
      type: "shape",
      style: { fill: "#00aa88", stroke: "#ff3366", strokeWidth: 24 },
    });
  });

  it("includes JSON previews for SVG quadratic and arc geometry", () => {
    const cubic = previewLabCaseById("path.geometry.cubic").project.layers[0];
    const quadratic = previewLabCaseById("path.geometry.quadratic").project.layers[0];
    const arc = previewLabCaseById("path.geometry.arc").project.layers[0];
    const closedArc = previewLabCaseById("path.geometry.arc-closed").project.layers[0];
    expect(cubic?.type).toBe("path");
    expect(quadratic?.type).toBe("path");
    expect(arc?.type).toBe("path");
    expect(closedArc?.type).toBe("path");
    expect(quadratic?.type === "path" && quadratic.payload.contours[0]?.segments.some((segment) => segment.kind === "quadratic")).toBe(true);
    expect(arc?.type === "path" && arc.payload.contours[0]?.segments.some((segment) => segment.kind === "arc")).toBe(true);
    expect(closedArc?.type === "path" && closedArc.payload.contours[0]?.closed).toBe(true);
  });

  it("keeps stroke examples on the same five-sided contour", () => {
    const stroke = previewLabCaseById("path.stroke").project.layers[0];
    const strokeWidth = previewLabCaseById("path.stroke-width").project.layers[0];
    expect(stroke?.type === "path" && stroke.style.strokeWidth).toBe(4);
    expect(strokeWidth?.type === "path" && strokeWidth.style.strokeWidth).toBe(18);
    expect(stroke?.type === "path" && stroke.payload.contours[0]?.segments).toHaveLength(5);
    expect(strokeWidth?.type === "path" && strokeWidth.payload.contours[0]?.segments).toHaveLength(5);
  });

  it("makes stroke opacity visible as an isolated preview property", () => {
    const strokeOpacity = previewLabCaseById("path.stroke-opacity").project.layers[0];
    expect(strokeOpacity?.type === "path" && strokeOpacity.style.stroke).toBe("#38bdf8");
    expect(strokeOpacity?.type === "path" && strokeOpacity.style.strokeOpacity).toBe(0.35);
    expect(strokeOpacity?.type === "path" && strokeOpacity.payload.contours[0]?.segments).toHaveLength(5);
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
      "Layers / Shape",
      "Layers / Path",
      "Layers / Image",
      "Layers / Video",
      "Layers / Text",
      "Layers / Group",
      "Transforms / Core",
      "Transforms / Extension",
      "Paint / Fill",
      "Paint / Stroke",
      "Paint / Gradient",
      "Paint / Pattern",
      "Paint / Order",
      "Paint / Markers",
      "Clip",
      "Mask",
      "Effects",
      "Compositing",
      "Timing",
      "Audio",
    ]);
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

  it("does not expose removed legacy rectangle paint fixtures", () => {
    const legacyPaintIds = PREVIEW_LAB_CASES
      .map((item) => item.id)
      .filter((id) => /^(rectangle\.(paint|gradient)|ellipse\.(paint|gradient))\./.test(id));
    expect(legacyPaintIds).toEqual([]);
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

  it("keeps layer order separate from SVG paint order", () => {
    const fixture = previewLabCaseById("path.paint-order.stroke-fill");
    expect(fixture.project.layers[0]).toMatchObject({
      order: 0,
      style: { paintOrder: ["stroke", "fill"] },
    });
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "drawPath",
      paintOrder: ["stroke", "fill", "markers"],
    }));
  });

  it("lowers a basic group as a balanced hierarchy scope", () => {
    const fixture = previewLabCaseById("group.basic");
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual({ op: "beginGroup", key: "basic-group", layerId: "basic-group" });
    expect(buffer.commands).toContainEqual({ op: "endGroup", key: "basic-group" });
    expect(buffer.commands.filter((command) => command.op === "drawPath")).toHaveLength(2);
  });

  it("preserves explicit SVG isolation even at full opacity", () => {
    const fixture = previewLabCaseById("group.explicit-isolation");
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "explicit-isolation-group",
      isolation: true,
      offscreen: true,
      compositeAlpha: 1,
    }));
  });

  it("keeps disabled group descendants semantic but emits no paint", () => {
    const fixture = previewLabCaseById("group.disabled");
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands.some((command) => command.key === "disabled-group-leaf")).toBe(false);
    expect(fixture.project.layers).toHaveLength(2);
  });

  it("lowers SVG visibility hidden without removing the semantic subtree", () => {
    const fixture = previewLabCaseById("group.visibility.hidden");
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(fixture.project.layers[0]).toMatchObject({ type: "group", visibility: "hidden" });
    expect(fixture.project.layers).toHaveLength(2);
    expect(buffer.commands.some((command) => command.key === "visibility-hidden-leaf")).toBe(false);
  });

  it("flattens group blend modes before compositing them with the backdrop", () => {
    for (const id of ["composite.blend.group.multiply", "composite.blend.group.screen"] as const) {
      const fixture = previewLabCaseById(id);
      const groupId = fixture.project.layers.find((layer) => layer.type === "group")!.id;
      expect(compileProtocolToPaintCommands(fixture.project, { time: 0 }).commands).toContainEqual(expect.objectContaining({
        op: "beginLayer",
        key: groupId,
        isolation: true,
        offscreen: true,
        blendMode: id.endsWith("multiply") ? "multiply" : "screen",
      }));
    }
  });

  it("intersects group timing with descendant timing", () => {
    const fixture = previewLabCaseById("group.timing");
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 1 });
    expect(buffer.commands.some((command) => command.key === "timed-group-leaf")).toBe(true);
    expect(buffer.commands.some((command) => command.key === "timed-group")).toBe(true);
  });

  it("lowers effects attached to the complete group subtree", () => {
    const fixture = previewLabCaseById("group.effects");
    const buffer = compileProtocolToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "effect-group",
      effectProgram: expect.objectContaining({ requiresOffscreen: true }),
      offscreen: true,
    }));
  });

});
