import { describe, expect, it } from "vitest";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";
import { evaluateCompositionFrame } from "../evaluate-composition";
import {
  evaluateNodeEffects,
  type RuntimeEffect,
  type RuntimeScene,
} from "../evaluator";
import { inflateBoundsForEffects } from "../render-plan";
import { compileProjectV1 } from "../testing/compile";
import { createNeonEffectsPreviewProject } from "../testing/effects-preview-project";

function sceneWithEffects(effects: RuntimeEffect[]): RuntimeScene {
  return {
    id: "scene.fx",
    duration: 2,
    layers: [
      {
        id: "card",
        type: "shape",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        ...visualLayerAtoms({
          x: 100,
          y: 100,
          width: 200,
          height: 120,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          originX: 0.5,
          originY: 0.5,
          opacity: 100,
          visible: true,
        }),
        payload: { shape: "rectangle" },
        effects,
      },
    ],
    propertyAnimations: [],
  } as RuntimeScene;
}

describe("inner-glow and noise evaluation", () => {
  it("evaluates inner-glow like glow without inflating bounds", () => {
    const scene = sceneWithEffects([
      {
        id: "fx-inner-glow-1",
        type: "inner-glow",
        radius: 18,
        color: "#A855FF",
        opacity: 60,
      },
    ]);
    const [effect] = evaluateNodeEffects(scene, scene.layers[0]!, 0);
    expect(effect).toMatchObject({
      type: "inner-glow",
      radius: 18,
      color: "#A855FF",
      opacity: 0.6,
    });
    expect(
      inflateBoundsForEffects({ x: 0, y: 0, width: 100, height: 80 }, [effect]),
    ).toEqual({ x: 0, y: 0, width: 100, height: 80 });
  });

  it("hashes a stable noise seed when animated is false", () => {
    const scene = sceneWithEffects([
      {
        id: "fx-noise-1",
        type: "noise",
        amount: 12,
        scale: 1,
        opacity: 25,
        animated: false,
      },
    ]);
    const a = evaluateNodeEffects(scene, scene.layers[0]!, 0)[0];
    const b = evaluateNodeEffects(scene, scene.layers[0]!, 1.5)[0];
    expect(a?.type).toBe("noise");
    expect(a).toMatchObject({ amount: 12, scale: 1, opacity: 0.25 });
    expect(a?.seed).toEqual(b?.seed);
    expect(
      inflateBoundsForEffects({ x: 0, y: 0, width: 10, height: 10 }, [a]),
    ).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

describe("compile → evaluate paint commands", () => {
  it("puts inner-glow and noise on an offscreen draw pass", () => {
    const runtime = compileProjectV1(createNeonEffectsPreviewProject());
    const frame = evaluateCompositionFrame(runtime, 0, 30, 400, 240);
    expect(frame).toBeTruthy();
    const withEffects = frame!.paint.commands.filter(
      (cmd) =>
        "effects" in cmd &&
        Array.isArray(cmd.effects) &&
        cmd.effects.length > 0,
    );
    expect(withEffects.length).toBeGreaterThan(0);
    const types = withEffects.flatMap((cmd) =>
      "effects" in cmd ? cmd.effects!.map((effect) => effect.type) : [],
    );
    expect(types).toEqual(expect.arrayContaining(["inner-glow", "noise"]));
    expect(
      frame!.paint.commands.some(
        (cmd) => cmd.op === "beginLayer" && cmd.offscreen,
      ),
    ).toBe(true);
  });
});
