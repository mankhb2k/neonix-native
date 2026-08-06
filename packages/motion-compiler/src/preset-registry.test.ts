import { describe, expect, it } from "vitest";
import {
  expandMotionPreset,
  isCompiledPreset,
  parsePresetParams,
} from "./preset-registry";
import { bakeMotionRecipe, isMotionRecipe } from "./recipe-registry";

describe("Phase 1 preset registry + recipes", () => {
  it("expands exit presets and typed distance params", () => {
    expect(isCompiledPreset("fade-out")).toBe(true);
    const tracks = expandMotionPreset({
      presetId: "fade-up",
      nodeId: "n1",
      start: 0,
      end: 0.5,
      transform: { x: 10, y: 20, opacity: 1, scaleX: 1, scaleY: 1 },
      params: { distance: 80 },
    });
    const y = tracks.find((t) => t.property === "transform.y");
    expect(y?.keys[0]?.v).toBe(100);
    expect(y?.keys[1]?.v).toBe(20);
  });

  it("rejects unknown preset params", () => {
    const bad = parsePresetParams("fade-in", { distance: -1 });
    expect(bad.ok).toBe(false);
  });

  it("bakes ambient breathing/drift/shimmer recipes", () => {
    expect(isMotionRecipe("breathing")).toBe(true);
    const baked = bakeMotionRecipe({
      recipeId: "drift",
      sceneId: "s",
      targetNodeId: "n",
      duration: 2,
      intensity: 0.5,
      frequencyHz: 0.4,
    });
    expect(baked.drivers[0]?.type).toBe("oscillator");
  });
});
