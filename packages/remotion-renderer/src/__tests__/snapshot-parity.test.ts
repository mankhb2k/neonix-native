import {
  buildRenderSnapshot,
  evaluateCompositionSnapshot,
  layerGraphFromRuntime,
} from "@motionvideo/motion-runtime";
import {
  createDemoMotionProject,
  DEMO_SCENE_ID,
  compileProjectV1,
} from "@motionvideo/motion-runtime/testing";
import { describe, expect, it } from "vitest";

describe("remotion-renderer snapshot contract", () => {
  it("builds drawable snapshot items from demo project", () => {
    const project = createDemoMotionProject();
    const runtime = compileProjectV1(project);
    const scene = layerGraphFromRuntime(runtime);
    expect(scene).toBeTruthy();

    const snapshot = buildRenderSnapshot({
      scene: scene!,
      time: 0,
      frame: 0,
      width: 1920,
      height: 1080,
      background: "#0c0b0a",
    });

    expect(snapshot.sceneId).toBe(DEMO_SCENE_ID);
    expect(snapshot.items.length).toBeGreaterThanOrEqual(4);

    const kinds = new Set(snapshot.items.map((item) => item.payload.kind));
    expect(kinds.has("shape")).toBe(true);
    expect(kinds.has("text")).toBe(true);
    expect(kinds.has("group")).toBe(true);

    const title = snapshot.items.find((item) => item.layerId === "node.title");
    expect(title?.payload.kind).toBe("text");
    if (title?.payload.kind === "text") {
      expect(title.payload.text).toBe("MotiClip AI Studio");
    }
  });

  it("evaluateCompositionSnapshot matches buildRenderSnapshot at probe frames", () => {
    const runtime = compileProjectV1(createDemoMotionProject());
    for (const frame of [0, 15, 45]) {
      const viaComposition = evaluateCompositionSnapshot(
        runtime,
        frame,
        30,
        1920,
        1080,
        DEMO_SCENE_ID,
        "#0c0b0a",
      );
      const scene = layerGraphFromRuntime(runtime);
      const viaBuild = buildRenderSnapshot({
        scene,
        time: frame / 30,
        frame,
        width: 1920,
        height: 1080,
        background: "#0c0b0a",
      });
      expect(viaComposition?.items.map((i) => i.key)).toEqual(
        viaBuild.items.map((i) => i.key),
      );
      expect(viaComposition?.items.map((i) => i.payload)).toEqual(
        viaBuild.items.map((i) => i.payload),
      );
    }
  });
});
