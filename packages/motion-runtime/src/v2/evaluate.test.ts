import { describe, expect, it } from "vitest";
import {
  IDENTITY_MATRIX4,
  multiplyMatrix4,
  orthographicMatrix2D,
  perspectiveProjectionMatrix2D,
  translationMatrix3D,
} from "../matrix4";
import { evaluateRuntimeProjectV2 } from "./evaluate";
import type { RuntimeProjectV2 } from "./types";

const project: RuntimeProjectV2 = {
  format: "motion-runtime",
  formatVersion: 2,
  id: "runtime-v2-shapes",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    background: "#101820",
    graphId: "runtime-v2-shapes",
  },
  view: {
    viewMatrix: IDENTITY_MATRIX4,
    projectionMatrix: orthographicMatrix2D(320, 180),
    viewProjectionMatrix: orthographicMatrix2D(320, 180),
  },
  nodes: [
    {
      id: "ellipse",
      parentId: null,
      zIndex: 1,
      timing: { start: 0, duration: 3 },
      opacity: 1,
      visible: true,
      localMatrix: translationMatrix3D(80, 40, 12),
      worldMatrix: translationMatrix3D(80, 40, 12),
      matrix2D: { a: 1, b: 0, c: 0, d: 1, e: 80, f: 40 },
      content: {
        kind: "shape",
        shape: "ellipse",
        width: 96,
        height: 64,
        fill: "#00aa88",
      },
    },
    {
      id: "inactive",
      parentId: null,
      zIndex: 0,
      timing: { start: 1, duration: 1 },
      opacity: 1,
      visible: true,
      localMatrix: IDENTITY_MATRIX4,
      worldMatrix: IDENTITY_MATRIX4,
      matrix2D: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      content: {
        kind: "shape",
        shape: "rectangle",
        width: 10,
        height: 10,
        fill: "#ff3366",
      },
    },
  ],
};

describe("Runtime IR V2", () => {
  it("evaluates active certified shapes into a deterministic paint buffer", () => {
    const frame = evaluateRuntimeProjectV2(project, 0);
    expect(frame.runtimeVersion).toBe(2);
    expect(frame.time).toBe(0);
    expect(frame.commands.map((command) => command.op)).toEqual([
      "beginFrame",
      "setTransform",
      "drawShape",
      "endFrame",
    ]);
    expect(frame.commands).toContainEqual(
      expect.objectContaining({
        op: "setTransform",
        key: "ellipse",
        matrix4: Array.from(translationMatrix3D(80, 40, 12)),
      }),
    );
  });

  it("uses frame-grid timing and stable z-index/id ordering", () => {
    const active = evaluateRuntimeProjectV2(
      {
        ...project,
        nodes: project.nodes.map((node) => ({
          ...node,
          timing: { start: 0, duration: 3 },
        })),
      },
      30,
    );
    expect(active.time).toBe(1);
    expect(
      active.commands
        .map((command) => ("key" in command ? command.key : undefined))
        .filter(Boolean),
    ).toEqual([
      "inactive",
      "inactive",
      "ellipse",
      "ellipse",
    ]);
  });

  it("keeps semantic gradient and independent paint opacity in Runtime V2", () => {
    const frame = evaluateRuntimeProjectV2(
      {
        ...project,
        nodes: [
          {
            ...project.nodes[0]!,
            content: {
              ...project.nodes[0]!.content,
              fill: "#ff0000",
              fillPaint: {
                type: "linear-gradient",
                angle: 0,
                stops: [
                  { offset: 0, color: "#ff0000" },
                  { offset: 1, color: "#0000ff" },
                ],
              },
              fillOpacity: 0.5,
              stroke: "#ffffff",
              strokeWidth: 8,
              strokeOpacity: 0.25,
            },
          },
        ],
      },
      0,
    );
    expect(frame.commands).toContainEqual(
      expect.objectContaining({
        op: "drawShape",
        fillPaint: expect.objectContaining({ type: "linear-gradient" }),
        fillOpacity: 0.5,
        strokeOpacity: 0.25,
      }),
    );
  });

  it("preserves the resolved Matrix4 and perspective projection contract", () => {
    const projection = perspectiveProjectionMatrix2D(320, 180, 60, 1, 4000);
    const frame = evaluateRuntimeProjectV2(
      {
        ...project,
        view: {
          viewMatrix: IDENTITY_MATRIX4,
          projectionMatrix: projection,
          viewProjectionMatrix: multiplyMatrix4(projection, IDENTITY_MATRIX4),
        },
      },
      0,
    );
    expect(frame.commands[0]).toEqual(
      expect.objectContaining({
        op: "beginFrame",
        projection: expect.objectContaining({
          projectionMatrix: Array.from(projection),
        }),
      }),
    );
    expect(frame.commands).toContainEqual(
      expect.objectContaining({
        op: "setTransform",
        key: "ellipse",
        matrix4: Array.from(translationMatrix3D(80, 40, 12)),
      }),
    );
  });
});
