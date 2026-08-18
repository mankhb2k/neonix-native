import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";
import { buildPaintCommandBuffer, decodePaintCommandBuffer } from "../paint";
import { evaluateCompositionFrameV1 } from "../evaluate-composition";
import type { RenderSnapshot, RenderSnapshotItem } from "../render-snapshot";
import {
  CLIP_MASK_TARGET_KINDS,
  clipMaskTargetProject,
  clipMaskGroupIsolationProject,
  clipMaskChildIsolationProject,
} from "../../../motion-protocol/src/v1/__fixtures__/masks/clip-mask-projects";

function compilePaint(raw: unknown) {
  const project = parseMotionProjectV1(raw);
  const compiled = compileMotionProjectV1(project);
  if (!compiled.ok) {
    throw new Error(compiled.diagnostics.map((d) => d.message).join("; "));
  }
  const frame = evaluateCompositionFrameV1(compiled.project, 0, 30, 400, 400);
  if (!frame) throw new Error("no frame");
  return frame.paint;
}

describe("clip mask paint nesting", () => {
  for (const kind of CLIP_MASK_TARGET_KINDS) {
    it(`emits clip beginLayer for ${kind}`, () => {
      const paint = compilePaint(clipMaskTargetProject(kind));
      const begin = paint.commands.find(
        (cmd) => cmd.op === "beginLayer" && cmd.mask?.mode === "clip",
      );
      expect(begin?.op === "beginLayer" && begin.mask?.sourceKey).toBe(
        "root:clip-src",
      );
      expect(begin?.op === "beginLayer" && begin.mask?.sourceVisibility).toBe(
        "mask-only",
      );
    });
  }

  it("nests group children inside the masked beginLayer", () => {
    const paint = compilePaint(clipMaskGroupIsolationProject());
    const ops = paint.commands.map((cmd) => {
      if (cmd.op === "beginLayer") return `beginLayer:${cmd.key}`;
      if (cmd.op === "endLayer") return `endLayer:${cmd.key}`;
      if (cmd.op === "drawSolid") return `drawSolid:${cmd.layerId}`;
      if (cmd.op === "drawShape") return `drawShape:${cmd.layerId}`;
      return cmd.op;
    });
    const begin = ops.findIndex((op) =>
      op.startsWith("beginLayer:root:artwork"),
    );
    const end = ops.findIndex((op) => op.startsWith("endLayer:root:artwork"));
    const child = ops.findIndex((op) => op === "drawSolid:artwork-child");
    expect(begin).toBeGreaterThan(-1);
    expect(child).toBeGreaterThan(begin);
    expect(end).toBeGreaterThan(child);
    const sibling = ops.findIndex((op) => op === "drawSolid:sibling");
    expect(sibling).toBeGreaterThan(-1);
    expect(sibling < begin || sibling > end).toBe(true);
  });

  it("child mask does not wrap sibling draws", () => {
    const paint = compilePaint(clipMaskChildIsolationProject());
    const ops = paint.commands.map((cmd) => {
      if (cmd.op === "beginLayer") return `beginLayer:${cmd.key}`;
      if (cmd.op === "endLayer") return `endLayer:${cmd.key}`;
      if (cmd.op === "drawSolid") return `drawSolid:${cmd.layerId}`;
      return cmd.op;
    });
    const begin = ops.findIndex((op) =>
      op.startsWith("beginLayer:root:artwork"),
    );
    const end = ops.findIndex((op) => op.startsWith("endLayer:root:artwork"));
    const sibling = ops.findIndex((op) => op === "drawSolid:sibling");
    expect(sibling < begin || sibling > end).toBe(true);
  });

  it("nests snapshot children by parentLayerId", () => {
    const items: RenderSnapshotItem[] = [
      {
        key: "test:g1",
        graphId: "test",
        layerId: "g1",
        nodeType: "group",
        worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        worldBounds: { x: 0, y: 0, width: 200, height: 200 },
        worldOpacity: 1,
        visible: true,
        selectable: true,
        locked: false,
        renderOrder: 0,
        payload: { kind: "group", width: 200, height: 200 },
        depth: 0,
        projectedOffset: { x: 0, y: 0 },
        compositing: {
          isolation: "isolate",
          needsOffscreen: true,
          isAdjustment: false,
          mask: {
            mode: "clip",
            sourceLayerId: "clip",
            sourceVisibility: "mask-only",
          },
          effectOrder: [],
        },
      },
      {
        key: "test:child",
        graphId: "test",
        layerId: "child",
        parentLayerId: "g1",
        nodeType: "solid",
        worldMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        worldBounds: { x: 0, y: 0, width: 100, height: 100 },
        worldOpacity: 1,
        visible: true,
        selectable: true,
        locked: false,
        renderOrder: 1,
        payload: {
          kind: "solid",
          fill: "#f00",
          width: 100,
          height: 100,
        },
        depth: 1,
        projectedOffset: { x: 0, y: 0 },
      },
    ];
    const snapshot: RenderSnapshot = {
      graphId: "test",
      frame: 0,
      time: 0,
      width: 400,
      height: 400,
      space: "flat-2d",
      projection: { kind: "orthographic" },
      cameraMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      items,
    };
    const list = decodePaintCommandBuffer(buildPaintCommandBuffer(snapshot));
    expect(list.roots[0]?.kind).toBe("layer");
    if (list.roots[0]?.kind === "layer") {
      expect(list.roots[0].mask?.mode).toBe("clip");
      const draws = list.roots[0].children.flatMap((n) =>
        n.kind === "drawable" ? [n] : n.kind === "group" ? n.children : [],
      );
      expect(
        draws.some((n) => n.kind === "drawable" && n.key === "test:child"),
      ).toBe(true);
    }
  });
});
