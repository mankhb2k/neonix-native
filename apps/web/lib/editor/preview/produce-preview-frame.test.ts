import { describe, expect, it } from "vitest";
import {
  compileProjectV1,
  createDemoMotionProject,
} from "@motionvideo/motion-runtime/testing";
import type { Canvas2DReplayContext } from "@motionvideo/motion-runtime";
import {
  paintUrisFromFrame,
  producePreviewFrame,
} from "./produce-preview-frame";

type Op = { op: string; w?: number; h?: number };

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
    fillRect(_x: number, _y: number, w: number, h: number) {
      ops.push({ op: "fillRect", w, h });
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
    fillText() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    closePath() {},
    drawImage() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
  } satisfies Canvas2DReplayContext;
  return { ctx, ops };
}

describe("producePreviewFrame", () => {
  it("replays paint into a buffer matching composition size", () => {
    const runtime = compileProjectV1(createDemoMotionProject());
    const { ctx, ops } = createMockCtx();
    const width = 320;
    const height = 180;
    const produced = producePreviewFrame({
      runtime,
      time: 0,
      fps: 30,
      width,
      height,
      ctx,
    });
    expect(produced).not.toBeNull();
    expect(produced!.evaluated.viewport).toEqual({ width, height });
    const begin = produced!.evaluated.paint.commands.find(
      (cmd) => cmd.op === "beginFrame",
    );
    expect(begin).toMatchObject({ op: "beginFrame", width, height });
    expect(ops.some((o) => o.op === "fillRect" && o.w === width && o.h === height)).toBe(
      true,
    );
    expect(produced!.evaluated.paint.commands.length).toBeGreaterThan(1);
    expect(paintUrisFromFrame(produced!.evaluated)).toEqual([]);
  });
});
