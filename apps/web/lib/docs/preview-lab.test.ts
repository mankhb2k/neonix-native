import { describe, expect, it } from "vitest";
import { compileProtocolV2ToPaintCommands } from "@motionvideo/motion-compiler";
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
      "image.fit.contain",
      "image.fit.cover",
      "image.crop",
      "image.missing-asset",
      "composite.blend.normal",
      "composite.blend.multiply",
      "composite.blend.screen",
      "composite.blend.add",
      "composite.blend.stack.normal",
      "composite.blend.stack.multiply",
      "composite.blend.stack.screen",
      "composite.blend.stack.add",
      "video.frame-seek",
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
      "rectangle.mat4.rotate-x-perspective",
      "rectangle.mat4.rotate-y-perspective",
      "rectangle.mat4.translate-z-perspective",
      "rectangle.timing",
      "rectangle.opacity",
      "rectangle.z-index",
      "matrix4.2d.identity",
      "matrix4.2d.rotate-z",
      "matrix4.2d.skew",
      "matrix4.3d.rotate-x",
      "matrix4.3d.rotate-y",
      "matrix4.3d.translate-z",
      "matrix4.3d.anchor-z",
      "matrix4.camera-plane",
    ]);
    expect(PREVIEW_LAB_DEFAULT_CASE).toBe("primitive.shape.rectangle");
    expect(previewLabCaseById(null).id).toBe(PREVIEW_LAB_DEFAULT_CASE);
  });

  it("parses and compiles every V2 fixture without V1", () => {
    for (const fixture of PREVIEW_LAB_CASES) {
      const project = MotionProtocolV2Schema.parse(fixture.project);
      const buffer = compileProtocolV2ToPaintCommands(project, {
        time: fixture.previewTime ?? 0,
      });
      expect(buffer.commands[0]?.op).toBe("beginFrame");
      expect(buffer.commands.at(-1)?.op).toBe("endFrame");
    }
  });

  it("organizes the sidebar by render concept instead of implementation task", () => {
    const groups = previewLabGroups();
    expect(groups.map((group) => group.label)).toEqual([
      "Primitives",
      "Primitives / rounded",
      "Transforms & 3D",
      "Groups",
      "Paths",
      "Paint / strokes",
      "Paint / gradients",
      "Paint / opacity",
      "Images",
      "Video",
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
        zIndex: 0,
        payload: { assetId: "preview-image-v2" },
      },
      {
        id: "blend-stack-snow-screen",
        zIndex: 1,
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
          mask: { mode: "clip", sourceLayerId: "clip-mask-ellipse", sourceVisibility: "mask-only" },
        },
      },
      { id: "clip-mask-ellipse", parentLayerId: "clip-mask-group", type: "shape" },
      { id: "clip-mask-content", parentLayerId: "clip-mask-group", type: "image" },
    ]);
    const buffer = compileProtocolV2ToPaintCommands(fixture.project, { time: 0 });
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
      composite: { mask: { mode: "alpha", sourceLayerId: "alpha-mask-ellipse", sourceVisibility: "mask-only" } },
    });
    expect(fixture.project.layers[1]).toMatchObject({
      id: "alpha-mask-ellipse",
      style: { fillOpacity: 0.45 },
    });
    const buffer = compileProtocolV2ToPaintCommands(fixture.project, { time: 0 });
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
      composite: { mask: { mode: "inverse-alpha", sourceLayerId: "inverse-alpha-mask-ellipse", sourceVisibility: "mask-only" } },
    });
    const buffer = compileProtocolV2ToPaintCommands(fixture.project, { time: 0 });
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
      composite: { mask: { mode: "luma", sourceLayerId: "luma-mask-ellipse", sourceVisibility: "mask-only" } },
    });
    expect(fixture.project.layers[1]).toMatchObject({ style: { fill: "#808080" } });
    const buffer = compileProtocolV2ToPaintCommands(fixture.project, { time: 0 });
    expect(buffer.commands).toContainEqual(expect.objectContaining({
      op: "beginLayer",
      key: "luma-mask-group",
      mask: { mode: "luma", sourceKey: "luma-mask-ellipse", sourceVisibility: "mask-only" },
    }));
  });

  it("keeps nested isolation scopes balanced in runtime paint commands", () => {
    const fixture = previewLabCaseById("group.isolation.nested");
    const buffer = compileProtocolV2ToPaintCommands(fixture.project, { time: 0 });
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
    const buffer = compileProtocolV2ToPaintCommands(fixture.project, { time: 0 });
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
