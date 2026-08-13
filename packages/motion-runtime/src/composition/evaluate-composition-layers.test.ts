import { describe, expect, it } from "vitest";
import {
  evaluateCompositionLayers,
  compositionTotalDuration,
} from "./evaluate-composition-layers";

describe("composition layer evaluator", () => {
  const scenes = [
    {
      sceneId: "a",
      start: 0,
      duration: 2,
      transitionOut: { type: "crossfade" as const, duration: 0.5 },
    },
    {
      sceneId: "b",
      start: 1.5,
      duration: 2,
      transitionIn: { type: "crossfade" as const, duration: 0.5 },
      transitionOut: { type: "cut" as const },
    },
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
      {
        sceneId: "a",
        start: 0,
        duration: 2,
        transitionOut: { type: "fade" as const, duration: 0.5, color: "#000" },
      },
      {
        sceneId: "b",
        start: 1.5,
        duration: 2,
        transitionIn: { type: "fade" as const, duration: 0.5, color: "#000" },
      },
    ];
    const plan = evaluateCompositionLayers(fadeScenes, 1.75, 1080, 1920);
    const outgoing = plan.layers.find((l) => l.sceneId === "a");
    expect(outgoing?.fadeOverlay).toBeGreaterThan(0);
    expect(outgoing?.fadeColor).toBe("#000");
  });

  it("computes total duration as max clip end", () => {
    expect(compositionTotalDuration(scenes)).toBe(3.5);
  });

  it("produces no layer during a gap between clips", () => {
    const gapped = [
      { sceneId: "a", start: 0, duration: 2 },
      { sceneId: "b", start: 3, duration: 2 },
    ];
    expect(evaluateCompositionLayers(gapped, 2.5, 1080, 1920).layers).toEqual(
      [],
    );
  });

  it("produces no layer past the final clip end", () => {
    const plan = evaluateCompositionLayers(
      [{ sceneId: "a", start: 0, duration: 2 }],
      5,
      1080,
      1920,
    );
    expect(plan.layers).toEqual([]);
  });

  it("applies trimStart and playbackRate to scene localTime", () => {
    const plan = evaluateCompositionLayers(
      [
        {
          sceneId: "a",
          start: 0,
          duration: 4,
          trimStart: 1,
          playbackRate: 2,
        },
      ],
      1,
      1080,
      1920,
      30,
    );
    // compositionLocal=1 → media = 1*2 + 1 = 3
    expect(plan.layers).toHaveLength(1);
    expect(plan.layers[0]!.localTime).toBeCloseTo(3);
  });

  it("uses sourceDuration so trimStart can walk past clip.duration", () => {
    const plan = evaluateCompositionLayers(
      [
        {
          sceneId: "a",
          start: 0,
          duration: 4,
          trimStart: 3,
          playbackRate: 1,
          sourceDuration: 10,
        },
      ],
      3.9,
      1080,
      1920,
      30,
    );
    expect(plan.layers).toHaveLength(1);
    expect(plan.layers[0]!.localTime).toBeCloseTo(6.9);
  });
});
