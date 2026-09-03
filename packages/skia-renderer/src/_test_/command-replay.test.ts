import { describe, expect, it } from "vitest";
import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { matrix4ToSkia3x3, replaySkiaCommands } from "../command";
import type { SkiaCanvas, SkiaCanvasKit, SkiaFont, SkiaPaint, SkiaTypeface } from "../canvas-kit";

describe("Skia command replay transforms", () => {
  it("maps the runtime column-major Matrix4 to CanvasKit's 3x3", () => {
    expect(matrix4ToSkia3x3([
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 1, 0,
      40, 50, 0, 1,
    ])).toEqual([
      2, 0, 40,
      0, 3, 50,
      0, 0, 1,
    ]);
  });

  it("rejects malformed matrices before touching Skia", () => {
    expect(() => matrix4ToSkia3x3([1, 2, 3])).toThrow("finite Matrix4");
    expect(() => matrix4ToSkia3x3([
      1, 0, 0, 0,
      0, Number.NaN, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ])).toThrow("finite Matrix4");
  });

  it("replays Runtime glyph IDs through CanvasKit Font.drawGlyphs", () => {
    const glyphCalls: Array<{ glyphs: number[]; positions: number[]; subpixel: boolean }> = [];
    class Paint implements SkiaPaint {
      delete() {}
      setAntiAlias() {}
      setColor() {}
      setAlphaf() {}
      setStyle() {}
      setStrokeWidth() {}
      setStrokeCap() {}
      setStrokeJoin() {}
      setShader() {}
    }
    class Font implements SkiaFont {
      subpixel = false;
      delete() {}
      setSubpixel(value: boolean) { this.subpixel = value; }
    }
    const font = new Font();
    const canvas: Pick<SkiaCanvas, "clear" | "save" | "restore" | "concat" | "drawGlyphs" | "drawPath" | "drawRect" | "drawRRect" | "drawOval" | "drawImageRect" | "clipRect" | "readPixels"> = {
      clear() {}, save: () => 1, restore() {}, concat() {}, drawRect() {}, drawRRect() {}, drawOval() {}, drawPath() {}, drawImageRect() {}, clipRect() {}, readPixels: () => null,
      drawGlyphs(glyphs, positions, _x, _y, activeFont) {
        glyphCalls.push({ glyphs: [...glyphs], positions: [...positions], subpixel: (activeFont as Font).subpixel });
      },
    };
    const kit = {
      Color: () => 0,
      Paint,
      Font: class { constructor() { return font; } },
      PaintStyle: { Fill: 0, Stroke: 1 },
      StrokeCap: { Butt: 0, Square: 1, Round: 2 },
      StrokeJoin: { Miter: 0, Bevel: 1, Round: 2 },
      Path: { MakeFromSVGString: () => null },
    } as unknown as SkiaCanvasKit;
    const typeface = { delete() {} } satisfies SkiaTypeface;
    const buffer = {
      commands: [
        { op: "beginFrame", width: 320, height: 180, background: "#000000" },
        { op: "setTransform", matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], alpha: 1, visible: true },
        {
          op: "drawText",
          key: "text", layerId: "text", text: "A", fontSize: 40, fontAssetId: "noto",
          width: 320, height: 180, fill: "#ffffff", align: "left", verticalAlign: "top", wrap: "none", overflow: "visible", direction: "ltr",
          glyphs: [{
            glyphId: 36, cluster: 0, clusterEnd: 1, x: 100, y: 20, width: 24, height: 30,
            path: "M 0 0 Z", pathScale: 0.04, outline: { x: 10, y: 760, width: 600, height: 750 },
            fontAssetId: "noto", fontSize: 40, renderMode: "grayscale-mask",
          }],
        },
        { op: "endFrame" },
      ],
    } as unknown as PaintCommandBuffer;

    const stats = replaySkiaCommands(kit, canvas as SkiaCanvas, buffer, new Map(), "#000000", () => typeface);

    expect(stats.nativeTextGlyphs).toBe(1);
    expect(stats.outlineTextGlyphs).toBe(0);
    expect(glyphCalls).toEqual([{ glyphs: [36], positions: [99.5999984741211, 50.400001525878906], subpixel: true }]);
  });
});
