import { describe, expect, it } from "vitest";
import { identityMatrix4, type PaintCommandBuffer, type PaintTextGlyph } from "@motionvideo/motion-runtime";
import { ExportRendererError } from "../src/errors";
import { encodeRgbaToPng, paintCommandsToSvg } from "../src/render/svg-rasterizer";

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

  it("encodes the native RGBA frame as a real PNG", async () => {
    const png = await encodeRgbaToPng(Buffer.from([34, 51, 68, 255]), 1, 1);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it("extracts a glyph from a shared SVG-in-OpenType sprite document", () => {
    const source = '</g></svg><svg xmlns="http://www.w3.org/2000/svg"><defs><path id="shared" d="M0 0"/></defs><g id="glyph41"><use href="#shared"/></g><g id="glyph42"><use href="#shared"/></g>';
    const glyph: PaintTextGlyph = {
      glyphId: 42,
      cluster: 0,
      clusterEnd: 1,
      x: 10,
      y: 20,
      width: 12,
      height: 14,
      path: "M 0 0",
      pathScale: 1,
      outline: { x: 0, y: 0, width: 1, height: 1 },
      colorGlyph: { kind: "bitmap", mimeType: "image/svg+xml", bytes: new TextEncoder().encode(source) },
    };
    const svg = paintCommandsToSvg({
      commands: [
        buffer.commands[0]!,
        { op: "setTransform", key: "text", matrix4: Array.from(identityMatrix4()), alpha: 1, visible: true, order: 0 },
        { op: "drawText", key: "text", layerId: "text", text: "👋", fontSize: 12, fill: "#fff", width: 20, height: 20, glyphs: [glyph] },
        buffer.commands[3]!,
      ],
      diagnostics: [],
    });
    const encoded = svg.match(/data:image\/svg\+xml;base64,([^"]+)/)?.[1];
    expect(encoded).toBeDefined();
    const standalone = Buffer.from(encoded!, "base64").toString("utf8");
    expect(standalone).toContain('viewBox="0 -1000 1000 1000"');
    expect(standalone).toContain('id="glyph42"');
    expect(standalone).not.toContain('id="glyph41"');
    expect(standalone.endsWith("</g></svg>")).toBe(true);
  });
});
