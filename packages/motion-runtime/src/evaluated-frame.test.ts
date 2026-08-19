import { visualLayerAtoms } from "@motionvideo/motion-protocol";
import { describe, expect, it } from "vitest";
import { evaluateFrame } from "./evaluated-frame";
import {
  capabilityReadyForAi,
  WAVE1_CAPABILITY_LEDGER,
} from "./capability-ledger";
import type { RuntimeScene } from "./evaluator";

function fixtureScene(): RuntimeScene {
  return {
    id: "scene.wave1",
    duration: 2,
    layers: [
      {
        id: "bg",
        type: "shape",
        parentLayerId: null,
        zIndex: 0,
        ...visualLayerAtoms({ x: 0, y: 0, width: 200, height: 100, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0, opacity: 100 }),
        payload: { shape: "rectangle" },
        style: { fill: "#1877F2" },
      },
      {
        id: "title",
        type: "text",
        parentLayerId: null,
        zIndex: 1,
        ...visualLayerAtoms({ x: 20, y: 30, width: 160, height: 40, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0, opacity: 100 }),
        payload: { text: "Wave1", fontSize: 24, alignment: "left" },
        style: { fill: "#ffffff" },
      },
    ],
    propertyAnimations: [
      {
        layerId: "title",
        property: "opacity",
        keys: [
          { t: 0, v: 0 },
          { t: 1, v: 100 },
        ],
      },
    ],
  } as unknown as RuntimeScene;
}

describe("evaluateFrame", () => {
  it("is deterministic for the same inputs", () => {
    const scene = fixtureScene();
    const a = evaluateFrame({
      scene,
      frame: 15,
      time: 0.5,
      width: 200,
      height: 100,
      background: "#000",
    });
    const b = evaluateFrame({
      scene,
      frame: 15,
      time: 0.5,
      width: 200,
      height: 100,
      background: "#000",
    });
    expect(a.graphId).toBe("scene.wave1");
    expect(a.paint.commands).toEqual(b.paint.commands);
    expect(a.interaction.items.map((i) => i.key)).toEqual(
      b.interaction.items.map((i) => i.key),
    );
  });

  it("emits beginFrame, draw ops, endFrame", () => {
    const frame = evaluateFrame({
      scene: fixtureScene(),
      frame: 30,
      time: 1,
      width: 200,
      height: 100,
    });
    const ops = frame.paint.commands.map((c) => c.op);
    expect(ops[0]).toBe("beginFrame");
    expect(ops[ops.length - 1]).toBe("endFrame");
    expect(ops).toContain("drawShape");
    expect(ops).toContain("drawText");
  });

  it("ledger has no AI-ready rows until pixi+worker are yes", () => {
    expect(WAVE1_CAPABILITY_LEDGER.every((r) => !capabilityReadyForAi(r))).toBe(
      true,
    );
  });
});
