import { describe, expect, it } from "vitest";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";
import { evaluateNodeEffects, type RuntimeScene } from "../evaluator";
import { inflateBoundsForEffects } from "../render-plan";

function sceneWithEffects(
  effects: NonNullable<RuntimeScene["layers"][number]["effects"]>,
): RuntimeScene {
  return {
    id: "scene.fx",
    duration: 2,
    layers: [
      {
        id: "card",
        type: "shape",
        parentLayerId: null,
        zIndex: 0,
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
      inflateBoundsForEffects({ x: 0, y: 0, width: 100, height: 80 }, [
        scene.layers[0]!.effects![0]!,
      ]),
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
      inflateBoundsForEffects({ x: 0, y: 0, width: 10, height: 10 }, [
        scene.layers[0]!.effects![0]!,
      ]),
    ).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});
