import { describe, expect, it } from "vitest";
import { createV2EditorProject } from "@/lib/editor/document/demo-projects";
import {
  buildPlayheadTransformPatch,
  evaluateLayerAtPlayhead,
} from "@/lib/editor/animation/keyframes";

describe("playhead transform edits", () => {
  it("evaluates a track before calculating a stage edit", () => {
    const layer = createV2EditorProject("shape").layers[0]!;
    const animated = {
      ...layer,
      tracks: [{
        id: "position-x",
        path: "transform.translate.x" as const,
        keyframes: [
          { time: 0, value: { type: "number" as const, value: 100 } },
          { time: 1000, value: { type: "number" as const, value: 300 } },
        ],
      }],
    };

    expect(evaluateLayerAtPlayhead(animated, 0.5).transform.translate.x).toBe(200);
    expect(
      buildPlayheadTransformPatch(animated, 0.5, {
        translateDelta: { x: 20 },
      }).transform,
    ).toEqual({ translate: { x: layer.transform.translate.x + 20 } });
  });

  it("updates the exact keyframe without moving the base value", () => {
    const layer = createV2EditorProject("shape").layers[0]!;
    const animated = {
      ...layer,
      tracks: [{
        id: "position-x",
        path: "transform.translate.x" as const,
        keyframes: [
          { time: 0, value: { type: "number" as const, value: 100 } },
          { time: 500, value: { type: "number" as const, value: 200 } },
          { time: 1000, value: { type: "number" as const, value: 300 } },
        ],
      }],
    };

    const patch = buildPlayheadTransformPatch(animated, 0.5, {
      translateDelta: { x: 20 },
    });
    expect(patch.transform).toBeUndefined();
    expect(patch.tracks).toMatchObject([
      { keyframes: [{ time: 0 }, { time: 500, value: { type: "number", value: 220 } }, { time: 1000 }] },
    ]);
  });
});

