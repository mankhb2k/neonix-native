import { describe, expect, it } from "vitest";
import {
  PAINT_COMMAND_VERSION,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
import {
  buildRemotionPaintTree,
  contoursToSvgPathD,
  flattenRemotionDrawables,
} from "../build-remotion-paint-tree";

const buffer: PaintCommandBuffer = {
  version: PAINT_COMMAND_VERSION,
  diagnostics: [],
  commands: [
    {
      op: "beginFrame",
      width: 100,
      height: 80,
      background: "#fff",
      graphId: "s",
      frame: 0,
      time: 0,
    },
    {
      op: "setTransform",
      key: "s:shape",
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 5, f: 6 },
      alpha: 1,
      visible: true,
      zIndex: 0,
    },
    {
      op: "drawShape",
      key: "s:shape",
      layerId: "shape",
      shape: "rectangle",
      fill: "#00f",
      width: 40,
      height: 20,
    },
    {
      op: "setTransform",
      key: "s:path",
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      alpha: 1,
      visible: true,
      zIndex: 1,
    },
    {
      op: "drawPath",
      key: "s:path",
      layerId: "path",
      contours: [
        {
          id: "c0",
          start: { x: 0, y: 0 },
          closed: true,
          segments: [
            { kind: "line", to: { x: 10, y: 0 } },
            { kind: "line", to: { x: 10, y: 10 } },
          ],
        },
      ],
      fillRule: "nonzero",
      fill: "#f00",
    },
    { op: "endFrame" },
  ],
};

describe("buildRemotionPaintTree", () => {
  it("builds structural tree with drawable count", () => {
    const tree = buildRemotionPaintTree(buffer);
    expect(tree.width).toBe(100);
    expect(tree.roots).toHaveLength(2);
    expect(flattenRemotionDrawables(tree)).toHaveLength(2);
  });

  it("converts contours to SVG path d", () => {
    const d = contoursToSvgPathD([
      {
        id: "c0",
        start: { x: 0, y: 0 },
        closed: true,
        segments: [
          { kind: "line", to: { x: 10, y: 0 } },
          { kind: "line", to: { x: 10, y: 10 } },
        ],
      },
    ]);
    expect(d).toContain("M 0 0");
    expect(d).toContain("L 10 0");
    expect(d).toContain("Z");
  });

  it("fails closed on unsupported via tree flatten still exposing draw", () => {
    const bad: PaintCommandBuffer = {
      version: PAINT_COMMAND_VERSION,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          graphId: "s",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "s:x",
          matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          alpha: 1,
          visible: true,
          zIndex: 0,
        },
        {
          op: "unsupported",
          key: "s:x",
          layerId: "x",
          nodeType: "mesh",
          message: "nope",
        },
        { op: "endFrame" },
      ],
    };
    const tree = buildRemotionPaintTree(bad);
    const draws = flattenRemotionDrawables(tree);
    expect(draws[0]?.draw.op).toBe("unsupported");
  });
});
