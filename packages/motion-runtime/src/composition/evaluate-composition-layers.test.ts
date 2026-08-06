import { describe, expect, it } from "vitest";
import {
  evaluateCompositionLayers,
  compositionTotalDuration,
} from "./evaluate-composition-layers";

describe("composition layer evaluator", () => {
  const scenes = [
    { sceneId: "a", duration: 2, transition: { type: "crossfade" as const, duration: 0.5 } },
    { sceneId: "b", duration: 2, transition: { type: "cut" as const } },
  ];

  it("keeps single layer outside transitions", () => {
    const plan = evaluateCompositionLayers(scenes, 0.5, 1080, 1920);
    expect(plan.layers).toHaveLength(1);
    expect(plan.layers[0]!.sceneId).toBe("a");
    expect(plan.layers[0]!.opacity).toBe(1);
  });

  it("crossfade differs from hard cut during overlap", () => {
    const plan = evaluateCompositionLayers(scenes, 1.75, 1080, 1920);
    expect(plan.layers.length).toBeGreaterThanOrEqual(1);
    const outgoing = plan.layers.find((l) => l.sceneId === "a");
    const incoming = plan.layers.find((l) => l.sceneId === "b");
    expect(outgoing?.opacity ?? 1).toBeLessThan(1);
    expect(incoming).toBeTruthy();
    expect((incoming?.opacity ?? 0) > 0).toBe(true);
  });

  it("fade is not the same as crossfade (fade uses overlay)", () => {
    const fadeScenes = [
      { sceneId: "a", duration: 2, transition: { type: "fade" as const, duration: 0.5, color: "#000" } },
      { sceneId: "b", duration: 2 },
    ];
    const plan = evaluateCompositionLayers(fadeScenes, 1.75, 1080, 1920);
    const outgoing = plan.layers.find((l) => l.sceneId === "a");
    expect(outgoing?.fadeOverlay).toBeGreaterThan(0);
    expect(outgoing?.fadeColor).toBe("#000");
  });

  it("computes total duration with overlap", () => {
    expect(compositionTotalDuration(scenes)).toBe(3.5);
  });
});
