import { describe, expect, it } from "vitest";
import { evaluateCompositionLayers } from "./evaluate-composition-layers";

describe("evaluateCompositionLayers", () => {
  it("returns empty layers in a gap", () => {
    const plan = evaluateCompositionLayers(
      [
        { graphId: "a", start: 0, duration: 2 },
        { graphId: "b", start: 3, duration: 2 },
      ],
      2.5,
      1080,
      1920,
    );
    expect(plan.layers).toEqual([]);
  });

  it("renders active layers sorted by input order (track stack)", () => {
    const plan = evaluateCompositionLayers(
      [
        { graphId: "base", start: 0, duration: 5, opacity: 1, trackOrder: 0 },
        { graphId: "fx", start: 1, duration: 2, opacity: 0.5, trackOrder: 1 },
      ],
      1.5,
      1080,
      1920,
    );
    expect(plan.layers).toHaveLength(2);
    expect(plan.layers[0]!.graphId).toBe("base");
    expect(plan.layers[0]!.opacity).toBe(1);
    expect(plan.layers[1]!.graphId).toBe("fx");
    expect(plan.layers[1]!.opacity).toBe(0.5);
  });

  it("maps localTime from composition window", () => {
    const plan = evaluateCompositionLayers(
      [{ graphId: "a", start: 2, duration: 3 }],
      3,
      1080,
      1920,
    );
    expect(plan.layers).toHaveLength(1);
    expect(plan.layers[0]!.localTime).toBeCloseTo(1);
  });
});
