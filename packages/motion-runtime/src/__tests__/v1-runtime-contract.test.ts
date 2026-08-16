import { describe, expect, it } from "vitest";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";
import { evaluateScene, type RuntimeScene } from "../evaluator";
import { RuntimeDiagnosticCollector } from "../diagnostics";

function scene(overrides: Partial<RuntimeScene> = {}): RuntimeScene {
  return {
    id: "contract",
    duration: 2,
    layers: [
      {
        id: "title",
        type: "text",
        parentLayerId: null,
        zIndex: 0,
        timing: { start: 0, duration: 2 },
        ...visualLayerAtoms({
          width: 200,
          height: 80,
          x: 0,
          y: 0,
        }),
        payload: { text: "Hi", fontSize: 24, color: "#000000" },
        style: { fill: "#000000" },
      },
    ],
    tracks: [
      {
        layerId: "title",
        property: "appearance.opacity",
        keys: [
          { t: 0, v: 0 },
          { t: 1, v: 100 },
        ],
      },
    ],
    ...overrides,
  } as RuntimeScene;
}

describe("runtime V1 contract", () => {
  it("evaluates tracks compiled from timeline.clips", () => {
    const nodes = evaluateScene(scene(), 1);
    expect(nodes[0]?.transform.opacity).toBeCloseTo(1);
  });

  it("warns when a track is not applied by snapshot/paint", () => {
    const collector = new RuntimeDiagnosticCollector();
    evaluateScene(
      scene({
        tracks: [
          {
            layerId: "title",
            property: "style.fill",
            keys: [
              { t: 0, v: "#000000" },
              { t: 1, v: "#ffffff" },
            ],
          },
        ],
      }),
      0.5,
      collector,
    );
    expect(collector.diagnostics.some((d) => d.code === "TRACK_NOT_APPLIED")).toBe(
      true,
    );
  });
});
