import { describe, expect, it } from "vitest";
import { identityMatrix4, type PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { ExportRendererError } from "./errors";
import { paintCommandsToSvg } from "./svg-rasterizer";

const buffer: PaintCommandBuffer = {
  commands: [
    { op: "beginFrame", width: 100, height: 80, background: "#111827", graphId: "test", frame: 0, time: 0, projection: { worldToClipMatrix: Array.from(identityMatrix4()) } },
    { op: "setTransform", key: "box", matrix4: Array.from(identityMatrix4()), alpha: 1, visible: true, order: 0 },
    { op: "drawShape", key: "box", layerId: "box", shape: "rectangle", width: 20, height: 10, fill: "#22d3ee" },
    { op: "endFrame" },
  ],
  diagnostics: [],
};

describe("native SVG export", () => {
  it("serializes the V3 paint buffer into a rasterizable frame", () => {
    const svg = paintCommandsToSvg(buffer);
    expect(svg).toContain('fill="#111827"');
    expect(svg).toContain('fill="#22d3ee"');
    expect(svg).toContain("matrix(1 0 0 1 0 0)");
  });

  it("fails closed for video commands", () => {
    const video = { ...buffer, commands: [...buffer.commands.slice(0, 1), { op: "setTransform", key: "video", matrix4: Array.from(identityMatrix4()), alpha: 1, visible: true, order: 0 }, { op: "drawVideo", key: "video", layerId: "video", assetId: "a", width: 10, height: 10, mediaTime: 0 }, { op: "endFrame" }] } as PaintCommandBuffer;
    expect(() => paintCommandsToSvg(video)).toThrowError(ExportRendererError);
  });
});
