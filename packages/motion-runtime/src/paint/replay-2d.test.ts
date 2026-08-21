import { describe, it, expect } from "vitest";
import {
  replayPaintCommands2D,
  type Canvas2DReplayContext,
} from "./replay-2d";
import type { PaintCommandBuffer } from "./paint-buffer";

type Op =
  | { op: "fillRect"; x: number; y: number; w: number; h: number; fill: unknown }
  | { op: "fillText"; text: string }
  | { op: "ellipse" }
  | { op: "rect" };

function createMockCtx() {
  const ops: Op[] = [];
  const ctx = {
    fillStyle: "#000",
    strokeStyle: "#000",
    font: "",
        textAlign: "left" as const,
        textBaseline: "top",
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
    lineWidth: 1,
    save() {},
    restore() {},
    setTransform() {},
    fillRect(x: number, y: number, w: number, h: number) {
      ops.push({ op: "fillRect", x, y, w, h, fill: ctx.fillStyle });
    },
    beginPath() {},
    rect() {
      ops.push({ op: "rect" });
    },
    ellipse() {
      ops.push({ op: "ellipse" });
    },
    fill() {},
    stroke() {},
    fillText(text: string) {
      ops.push({ op: "fillText", text });
    },
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    closePath() {},
    drawImage() {},
    createLinearGradient() {
      return {
        addColorStop() {},
      };
    },
    createRadialGradient() {
      return {
        addColorStop() {},
      };
    },
  } satisfies Canvas2DReplayContext;
  return { ctx, ops };
}

describe("replayPaintCommands2D", () => {
  it("fills the frame background then draws a rect and text", () => {
    const { ctx, ops } = createMockCtx();
    const buffer: PaintCommandBuffer = {
      commands: [
        {
          op: "beginFrame",
          width: 100,
          height: 80,
          background: "#112233",
          graphId: "g",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "shape",
          matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1],
          alpha: 1,
          visible: true,
          zIndex: 0,
        },
        {
          op: "drawShape",
          key: "shape",
          layerId: "s",
          shape: "rectangle",
          fill: "#ff0000",
          width: 40,
          height: 30,
        },
        {
          op: "setTransform",
          key: "text",
          matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          alpha: 1,
          visible: true,
          zIndex: 1,
        },
        {
          op: "drawText",
          key: "text",
          layerId: "t",
          text: "Hi",
          fontSize: 16,
          fill: "#ffffff",
          width: 80,
          height: 20,
        },
        { op: "endFrame" },
      ],
      diagnostics: [],
    };
    replayPaintCommands2D(ctx, buffer);
    expect(ops.some((o) => o.op === "fillRect" && o.w === 100 && o.h === 80)).toBe(
      true,
    );
    expect(ops.some((o) => o.op === "rect")).toBe(true);
    expect(ops.some((o) => o.op === "fillText" && o.text === "Hi")).toBe(true);
  });

  it("skips invisible transforms", () => {
    const { ctx, ops } = createMockCtx();
    replayPaintCommands2D(ctx, {
      commands: [
        {
          op: "beginFrame",
          width: 10,
          height: 10,
          graphId: "g",
          frame: 0,
          time: 0,
        },
        {
          op: "setTransform",
          key: "hidden",
          matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          alpha: 0,
          visible: false,
          zIndex: 0,
        },
        {
          op: "drawShape",
          key: "hidden",
          layerId: "s",
          shape: "ellipse",
          fill: "#fff",
          width: 10,
          height: 10,
        },
      ],
      diagnostics: [],
    });
    expect(ops.some((o) => o.op === "ellipse")).toBe(false);
  });
});
