/**
 * Contract: identical gesture inputs produce identical preview/commit payloads
 * for Web and Desktop host adapters (both call the same package APIs).
 */
import { describe, expect, it } from "vitest";
import {
  createStageSession,
  resolveClipMoveDrag,
  shouldCommitPointerSession,
  type ClipMoveDragInput,
} from "../index";

const sharedMoveInput: ClipMoveDragInput = {
  clipId: "c1",
  clip: { kind: "scene" },
  originStartTime: 2,
  originLaneId: "lane-main",
  originTrack: "main",
  grabOffsetSec: 0.5,
  pointerContentX: 250,
  pixelsPerSecond: 100,
  duration: 3,
  drop: {
    laneId: "lane-main",
    track: "main",
  },
  snapPoints: [],
  snapThresholdSec: 0.08,
};

describe("web/desktop host contract", () => {
  it("clip-move: same resolveClipMoveDrag input → same preview + commit", () => {
    const webResult = resolveClipMoveDrag(sharedMoveInput);
    const desktopResult = resolveClipMoveDrag({ ...sharedMoveInput });
    expect(webResult).toEqual(desktopResult);
    expect(desktopResult.commit.startTime).toBeCloseTo(2, 5);
    expect(desktopResult.commit.laneId).toBe("lane-main");
  });

  it("pointer session: commit gate is shared", () => {
    expect(shouldCommitPointerSession("pointerup")).toBe(true);
    expect(shouldCommitPointerSession("pointercancel")).toBe(false);
    expect(shouldCommitPointerSession("escape")).toBe(false);
  });

  it("stage session: same move → same transform command fields", () => {
    const base = {
      rootLayerId: "scene",
      layerId: "node",
      x: 10,
      y: 20,
      width: 40,
      height: 30,
      rotation: 0,
    };
    const run = () => {
      const session = createStageSession();
      session.beginMove(
        {
          interactionId: "contract-1",
          base,
          worldBounds: { x: 100, y: 50, width: 40, height: 30 },
          pointer: { x: 0, y: 0 },
        },
        { onPreview: () => undefined },
      );
      session.updatePointer({ x: 15, y: -5 });
      return session.commit("pointerup");
    };
    expect(run()).toEqual(run());
  });
});
