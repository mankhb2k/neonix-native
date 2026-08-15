import { describe, expect, it } from "vitest";
import { Container } from "pixi.js";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";
import { evaluateCompositionFrameV1 } from "@motionvideo/motion-runtime";
import { createPixiFramePainter } from "../PixiFramePainter";
import {
  CLIP_MASK_TARGET_KINDS,
  clipMaskTargetProject,
  clipMaskGroupIsolationProject,
  clipMaskChildIsolationProject,
} from "../../../motion-protocol/src/v1/__fixtures__/masks/clip-mask-projects";

function paintProject(raw: unknown) {
  const project = parseMotionProjectV1(raw);
  const compiled = compileMotionProjectV1(project);
  if (!compiled.ok) {
    throw new Error(compiled.diagnostics.map((d) => d.message).join("; "));
  }
  const frame = evaluateCompositionFrameV1(compiled.project, 0, 30, 400, 400);
  if (!frame) throw new Error("no frame");
  const root = new Container({ sortableChildren: true });
  const painter = createPixiFramePainter({ root });
  painter.paintCommands(frame.paint);
  return { painter, paint: frame.paint };
}

describe("clip mask e2e (Pixi)", () => {
  for (const kind of CLIP_MASK_TARGET_KINDS) {
    it(`wires clip stencil for ${kind}`, () => {
      const { painter } = paintProject(clipMaskTargetProject(kind));
      const layers = painter.getCompositingLayers();
      const target =
        layers.get("root:artwork") ??
        layers.get("root:artwork__instance");
      expect(target?.maskSourceKey).toBe("root:clip-src");
      expect(target?.display.mask).toBeTruthy();
      painter.dispose();
    });
  }

  it("masks the group layer, not the sibling", () => {
    const { painter } = paintProject(clipMaskGroupIsolationProject());
    const layers = painter.getCompositingLayers();
    expect(layers.get("root:artwork")?.display.mask).toBeTruthy();
    expect(layers.get("root:sibling")?.display.mask).toBeFalsy();
    painter.dispose();
  });

  it("masks the child only inside a group", () => {
    const { painter } = paintProject(clipMaskChildIsolationProject());
    const layers = painter.getCompositingLayers();
    expect(layers.get("root:artwork")?.display.mask).toBeTruthy();
    expect(layers.get("root:sibling")?.display.mask).toBeFalsy();
    painter.dispose();
  });
});
