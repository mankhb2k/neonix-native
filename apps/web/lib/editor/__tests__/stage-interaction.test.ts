import { describe, expect, it } from "vitest";
import {
  createStageSession,
  type StageTransformValues,
} from "@motionvideo/editor-interactions";

describe("stage interaction session", () => {
  it("previews move deltas and commits once", () => {
    const session = createStageSession();
    const previews: Array<StageTransformValues | null> = [];
    const base = {
      sceneId: "scene.demo",
      layerId: "node.dot",
      x: 100,
      y: 200,
      width: 72,
      height: 72,
      rotation: 0,
    };
    session.beginMove(
      {
        interactionId: "move-1",
        base,
        worldBounds: {
          x: base.x,
          y: base.y,
          width: base.width,
          height: base.height,
        },
        pointer: { x: 10, y: 10 },
      },
      {
        onPreview: (payload) => {
          previews[0] = payload.patches[0] ?? null;
        },
      },
    );
    session.updatePointer({ x: 40, y: 25 });
    expect(previews[0]?.x).toBe(130);
    expect(previews[0]?.y).toBe(215);

    const committed = session.commit("pointerup");
    expect(committed?.patches[0]?.values.x).toBe(130);
    expect(session.mode).toBe("idle");
  });

  it("Escape path cancels without commit payload", () => {
    const session = createStageSession();
    const previews: Array<StageTransformValues | null> = [];
    session.beginResize(
      {
        interactionId: "resize-1",
        base: {
          sceneId: "s",
          layerId: "n",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          rotation: 0,
        },
        worldBounds: { x: 0, y: 0, width: 100, height: 50 },
        handle: "se",
        pointer: { x: 100, y: 50 },
      },
      {
        onPreview: (payload) => {
          previews[0] = payload.patches[0] ?? null;
        },
      },
    );
    session.updatePointer({ x: 140, y: 80 });
    session.cancel();
    expect(previews[0]).toBeNull();
    expect(session.commit()).toBeNull();
  });
});
