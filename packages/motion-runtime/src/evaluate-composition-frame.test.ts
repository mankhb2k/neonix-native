import { describe, expect, it } from "vitest";
import {
  evaluateCompositionFrame,
  evaluateCompositionSnapshot,
} from "./evaluate-composition";
import { evaluateFrame } from "./evaluated-frame";
import { compileProjectV1 } from "./testing/compile";
import { createDemoMotionProject, DEMO_SCENE_ID } from "./testing/demo-project";
import { layerGraphFromRuntime } from "./layer-graph";

function compileDemo() {
  return compileProjectV1(createDemoMotionProject());
}

describe("evaluateCompositionFrame", () => {
  it("returns one EvaluatedFrame with interaction and paint from the same pass", () => {
    const runtime = compileDemo();
    const evaluated = evaluateCompositionFrame(
      runtime,
      0,
      30,
      1920,
      1080,
      DEMO_SCENE_ID,
    );
    expect(evaluated).toBeTruthy();
    expect(evaluated!.sceneId).toBe(DEMO_SCENE_ID);
    expect(evaluated!.interaction.sceneId).toBe(DEMO_SCENE_ID);
    expect(evaluated!.paint.commands.length).toBeGreaterThan(0);
    expect(evaluated!.diagnostics).toEqual(evaluated!.paint.diagnostics);
  });

  it("shares one evaluate with evaluateCompositionSnapshot", () => {
    const runtime = compileDemo();
    const evaluated = evaluateCompositionFrame(
      runtime,
      15,
      30,
      1920,
      1080,
      DEMO_SCENE_ID,
    );
    const snapshot = evaluateCompositionSnapshot(
      runtime,
      15,
      30,
      1920,
      1080,
      DEMO_SCENE_ID,
    );
    expect(snapshot).toEqual(evaluated!.interaction);
  });

  it("matches scene-local evaluateFrame for the same inputs", () => {
    const runtime = compileDemo();
    const scene = layerGraphFromRuntime(runtime);
    const composed = evaluateCompositionFrame(
      runtime,
      10,
      30,
      800,
      600,
      DEMO_SCENE_ID,
    );
    const local = evaluateFrame({
      scene,
      frame: 10,
      time: 10 / 30,
      width: 800,
      height: 600,
    });
    expect(composed!.interaction.items.map((item) => item.layerId)).toEqual(
      local.interaction.items.map((item) => item.layerId),
    );
    expect(composed!.paint.commands.length).toBe(local.paint.commands.length);
  });
});
