import { describe, expect, it } from "vitest";
import { identityMatrix4, matrix4FromValues } from "../geometry/matrix4";
import type { PathContour } from "../paint/paint-types";
import { evaluateVisualRuntimeProject } from "./evaluate";
import type { VisualRuntimeNode, VisualRuntimeProject } from "./types";

const contour = (id: string): PathContour => ({
  id,
  start: { x: 0, y: 0 },
  segments: [
    { kind: "line", to: { x: 10, y: 0 } },
    { kind: "line", to: { x: 10, y: 4 } },
    { kind: "line", to: { x: 0, y: 4 } },
  ],
  closed: true,
});

const pathNode = (
  id: string,
  order: number,
  fill: string,
  x: number,
): VisualRuntimeNode => ({
  id,
  parentId: "border-group",
  order,
  timing: { start: 0, duration: 10 },
  opacity: 1,
  visible: true,
  localMatrix: matrix4FromValues([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, 0, 0, 1,
  ]),
  worldMatrix: identityMatrix4(),
  content: {
    kind: "path",
    width: 10,
    height: 4,
    contours: [contour(`${id}-contour`)],
    fillRule: "nonzero",
    fill,
    mesh: {
      vertices: [0, 0, 10, 0, 10, 4, 0, 4],
      indices: [0, 1, 2, 0, 2, 3],
      bounds: { x: 0, y: 0, width: 10, height: 4 },
    },
  },
});

const projectWith = (nodes: VisualRuntimeNode[]): VisualRuntimeProject => ({
  format: "motion-runtime",
  formatVersion: 2,
  id: "border-batch-test",
  composition: { width: 320, height: 180, fps: 30, graphId: "border-batch-test" },
  view: { worldToClipMatrix: identityMatrix4() },
  nodes,
});

const groupNode: VisualRuntimeNode = {
  id: "border-group",
  parentId: null,
  order: 0,
  timing: { start: 0, duration: 10 },
  opacity: 1,
  visible: true,
  localMatrix: identityMatrix4(),
  worldMatrix: identityMatrix4(),
  content: { kind: "group", width: 320, height: 180 },
};

describe("Runtime V2 border fragment batching", () => {
  it("combines adjacent same-paint border fragments into one path", () => {
    const frame = evaluateVisualRuntimeProject(
      projectWith([
        groupNode,
        pathNode("box::border:top:0", 1, "#38bdf8", 0),
        pathNode("box::border:top:1", 2, "#38bdf8", 12),
      ]),
      0,
    );
    const draws = frame.commands.filter((command) => command.op === "drawPath");
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({
      key: "border-group:border-batch:top",
      layerId: "border-group",
      fill: "#38bdf8",
    });
    if (draws[0]?.op === "drawPath") {
      expect(draws[0].contours).toHaveLength(2);
      expect(draws[0].contours[1]?.start).toEqual({ x: 12, y: 0 });
    }
  });

  it("keeps incompatible fragments on the normal per-node path", () => {
    const frame = evaluateVisualRuntimeProject(
      projectWith([
        groupNode,
        pathNode("box::border:top:0", 1, "#38bdf8", 0),
        pathNode("box::border:top:1", 2, "#38bdf8", 12),
        pathNode("box::border:top:2", 3, "#f43f5e", 24),
      ]),
      0,
    );
    const draws = frame.commands.filter((command) => command.op === "drawPath");
    expect(draws).toHaveLength(2);
    expect(draws.map((draw) => draw.key)).toEqual([
      "border-group:border-batch:top",
      "box::border:top:2",
    ]);
  });
});
