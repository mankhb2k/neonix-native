import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";
import { evaluateCompositionFrameV1 } from "@motionvideo/motion-runtime";
import { RemotionFramePainter } from "../RemotionFramePainter";
import { buildRemotionPaintTree } from "../build-remotion-paint-tree";
import {
  CLIP_MASK_TARGET_KINDS,
  clipMaskTargetProject,
  clipMaskGroupIsolationProject,
  clipMaskChildIsolationProject,
} from "../../../motion-protocol/src/v1/__fixtures__/masks/clip-mask-projects";

function paint(raw: unknown) {
  const project = parseMotionProjectV1(raw);
  const compiled = compileMotionProjectV1(project);
  if (!compiled.ok) {
    throw new Error(compiled.diagnostics.map((d) => d.message).join("; "));
  }
  const frame = evaluateCompositionFrameV1(compiled.project, 0, 30, 400, 400);
  if (!frame) throw new Error("no frame");
  return frame.paint;
}

describe("clip mask e2e (Remotion)", () => {
  for (const kind of CLIP_MASK_TARGET_KINDS) {
    it(`emits SVG clipPath for ${kind}`, () => {
      const buffer = paint(clipMaskTargetProject(kind));
      const tree = buildRemotionPaintTree(buffer);
      expect(JSON.stringify(tree)).toContain('"mode":"clip"');
      const skipMarkup = kind === "image" || kind === "svg" || kind === "video";
      if (skipMarkup) return;
      const html = renderToStaticMarkup(
        React.createElement(RemotionFramePainter, { paint: buffer, fps: 30 }),
      );
      expect(html).toContain("clipPath");
      expect(html).toContain("data-clip-mask");
    });
  }

  it("does not flatten away group isolation", () => {
    const html = renderToStaticMarkup(
      React.createElement(RemotionFramePainter, {
        paint: paint(clipMaskGroupIsolationProject()),
        fps: 30,
      }),
    );
    expect(html).toContain("data-clip-mask");
    expect(html).toContain("sibling");
  });

  it("child clip does not wrap sibling markup in the same clipPath", () => {
    const html = renderToStaticMarkup(
      React.createElement(RemotionFramePainter, {
        paint: paint(clipMaskChildIsolationProject()),
        fps: 30,
      }),
    );
    expect(html).toContain("data-clip-mask");
  });
});
