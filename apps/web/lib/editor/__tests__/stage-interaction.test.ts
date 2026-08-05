import { describe, expect, it } from "vitest";
import { useStageInteractionStore } from "@/lib/editor/interaction/stage-interaction-store";

describe("stage interaction session", () => {
  it("previews move deltas and commits once", () => {
    useStageInteractionStore.getState().cancel();
    const base = {
      sceneId: "scene.demo",
      nodeId: "node.dot",
      x: 100,
      y: 200,
      width: 72,
      height: 72,
      rotation: 0,
    };
    useStageInteractionStore.getState().beginMove(base, { x: 10, y: 10 });
    useStageInteractionStore.getState().updatePointer({ x: 40, y: 25 });
    const preview = useStageInteractionStore.getState().preview;
    expect(preview?.x).toBe(130);
    expect(preview?.y).toBe(215);

    const committed = useStageInteractionStore.getState().takeCommit();
    expect(committed?.x).toBe(130);
    expect(useStageInteractionStore.getState().mode).toBe("idle");
  });

  it("Escape path cancels without commit payload", () => {
    useStageInteractionStore.getState().cancel();
    useStageInteractionStore.getState().beginResize(
      {
        sceneId: "s",
        nodeId: "n",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: 0,
      },
      "se",
      { x: 100, y: 50 },
    );
    useStageInteractionStore.getState().updatePointer({ x: 140, y: 80 });
    useStageInteractionStore.getState().cancel();
    expect(useStageInteractionStore.getState().preview).toBeNull();
    expect(useStageInteractionStore.getState().takeCommit()).toBeNull();
  });
});
