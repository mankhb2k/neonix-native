import { describe, expect, it } from "vitest";
import {
  identityMatrix4,
  multiplyMatrix4,
  orthographicProjectionMatrix,
  perspectiveProjectionMatrix,
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
    worldToClipMatrix: orthographicProjectionMatrix(320, 180, 1, 1, 4000),
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
      localMatrix: identityMatrix4(),
      worldMatrix: identityMatrix4(),
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

  it("owns ordered effects on a layer scope rather than its drawable", () => {
    const frame = evaluateRuntimeProjectV2({
      ...project,
      nodes: [{
        ...project.nodes[0]!,
        content: {
          ...project.nodes[0]!.content,
          effects: [
            { id: "grade", type: "color-adjust", brightness: -0.1, contrast: 1.1, saturation: 0.8, hueRotate: 0 },
            { id: "soften", type: "blur", radius: 12 },
          ],
        },
      }],
    }, 0);

    expect(frame.commands.map((command) => command.op)).toEqual([
      "beginFrame",
      "beginLayer",
      "setTransform",
      "drawShape",
      "endLayer",
      "endFrame",
    ]);
    const scope = frame.commands.find((command) => command.op === "beginLayer");
    expect(scope).toMatchObject({ offscreen: true, effectProgram: { output: "effect:soften" } });
    const draw = frame.commands.find((command) => command.op === "drawShape");
    expect(draw).not.toHaveProperty("effects");
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

  it("resolves deterministic video media time from composition frames", () => {
    const videoRuntime: RuntimeProjectV2 = {
      ...project,
      id: "runtime-v2-video",
      nodes: [{
        id: "video",
        parentId: null,
        zIndex: 0,
        timing: { start: 0, duration: 6 },
        opacity: 1,
        visible: true,
        localMatrix: identityMatrix4(),
        worldMatrix: identityMatrix4(),
        content: {
          kind: "video",
          assetId: "clip",
          width: 160,
          height: 90,
          trimStart: 1,
          trimEnd: 4,
          sourceDuration: 60.5,
          sourceFps: 30,
          loop: true,
          muted: true,
          framePolicy: "floor",
        },
      }],
    };
    const first = evaluateRuntimeProjectV2(videoRuntime, 15);
    const looped = evaluateRuntimeProjectV2(videoRuntime, 105);
    expect(first.commands).toContainEqual(expect.objectContaining({
      op: "drawVideo",
      mediaTime: 1.5,
      mediaVisible: true,
      muted: true,
    }));
    expect(looped.commands).toContainEqual(expect.objectContaining({
      op: "drawVideo",
      mediaTime: 1.5,
      mediaVisible: true,
    }));
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

  it("emits a path's Runtime-resolved mesh without a second transform contract", () => {
    const frame = evaluateRuntimeProjectV2(
      {
        ...project,
        nodes: [
          {
            ...project.nodes[0]!,
            id: "triangle",
            content: {
              kind: "path",
              width: 220,
              height: 180,
              fill: "#00aa88",
              fillRule: "nonzero",
              contours: [{
                id: "triangle-contour",
                start: { x: 20, y: 10 },
                segments: [
                  { kind: "line", to: { x: 180, y: 40 } },
                  { kind: "line", to: { x: 70, y: 150 } },
                  { kind: "line", to: { x: 20, y: 10 } },
                ],
                closed: true,
              }],
              mesh: {
                vertices: [20, 10, 180, 40, 70, 150],
                indices: [0, 1, 2],
                bounds: { x: 20, y: 10, width: 160, height: 140 },
              },
            },
          },
        ],
      },
      0,
    );

    expect(frame.commands).toContainEqual(
      expect.objectContaining({
        op: "drawPath",
        key: "triangle",
        mesh: expect.objectContaining({ indices: [0, 1, 2] }),
      }),
    );
  });

  it("preserves the resolved Matrix4 and perspective projection contract", () => {
    const projection = perspectiveProjectionMatrix(320, 180, 60, 1, 4000);
    const frame = evaluateRuntimeProjectV2(
      {
        ...project,
        view: {
          worldToClipMatrix: projection,
        },
      },
      0,
    );
    expect(frame.commands[0]).toEqual(
      expect.objectContaining({
        op: "beginFrame",
        projection: expect.objectContaining({
          worldToClipMatrix: Array.from(projection),
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

  it("reports a layer that is entirely behind the camera", () => {
    const projection = perspectiveProjectionMatrix(320, 180, 60, 1, 4000);
    const frame = evaluateRuntimeProjectV2(
      {
        ...project,
        view: {
          worldToClipMatrix: projection,
        },
        nodes: [
          {
            ...project.nodes[0]!,
            worldMatrix: translationMatrix3D(0, 0, 1000),
            localMatrix: translationMatrix3D(0, 0, 1000),
          },
        ],
      },
      0,
    );

    expect(frame.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "layer_behind_camera",
        layerId: "ellipse",
      }),
    );
  });
});
