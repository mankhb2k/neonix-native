import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClipMovePreview } from "../clips/clip-move-geometry";
import {
  clearPreviewSession,
  getMovePinKey,
  getMovePreviewForLane,
  getPreviewSession,
  pinKeyFromPreview,
  setClipMovePreview,
  setDropGhost,
  setMarquee,
  subscribePreview,
} from "./timeline-preview-session";

function movePreview(
  patch: Partial<ClipMovePreview> &
    Pick<ClipMovePreview, "clipId" | "originLaneId" | "laneId">,
): ClipMovePreview {
  return {
    startTime: 0,
    duration: 1,
    valid: true,
    ...patch,
  };
}

describe("timeline-preview-session", () => {
  beforeEach(() => {
    clearPreviewSession();
  });

  afterEach(() => {
    clearPreviewSession();
  });

  it("keeps pin key stable when only pointer/time fields change", () => {
    setClipMovePreview(
      movePreview({
        clipId: "c1",
        originLaneId: "base",
        laneId: "base",
        startTime: 1,
        clientX: 10,
        clientY: 20,
      }),
    );
    const key1 = getMovePinKey();
    expect(key1).toBe("base|base|");

    setClipMovePreview(
      movePreview({
        clipId: "c1",
        originLaneId: "base",
        laneId: "base",
        startTime: 2.5,
        clientX: 99,
        clientY: 40,
      }),
    );
    expect(getMovePinKey()).toBe(key1);
  });

  it("changes pin key when target or member lanes retarget", () => {
    setClipMovePreview(
      movePreview({
        clipId: "c1",
        originLaneId: "base",
        laneId: "base",
      }),
    );
    const key1 = getMovePinKey();

    setClipMovePreview(
      movePreview({
        clipId: "c1",
        originLaneId: "base",
        laneId: "overlay-1",
      }),
    );
    expect(getMovePinKey()).not.toBe(key1);
    expect(getMovePinKey()).toBe("base|overlay-1|");

    setClipMovePreview(
      movePreview({
        clipId: "c1",
        originLaneId: "base",
        laneId: "overlay-1",
        members: [
          { clipId: "c2", laneId: "audio-1", startTime: 0, duration: 1 },
          { clipId: "c3", laneId: "audio-0", startTime: 0, duration: 1 },
        ],
      }),
    );
    expect(pinKeyFromPreview(getPreviewSession().clipMovePreview)).toBe(
      "base|overlay-1|audio-0,audio-1",
    );
  });

  it("lane selector returns stable null for unrelated lanes", () => {
    setClipMovePreview(
      movePreview({
        clipId: "c1",
        originLaneId: "base",
        laneId: "overlay-1",
      }),
    );
    const missA = getMovePreviewForLane("other");
    const missB = getMovePreviewForLane("other");
    expect(missA).toBeNull();
    expect(missB).toBe(missA);

    expect(getMovePreviewForLane("base")).not.toBeNull();
    expect(getMovePreviewForLane("overlay-1")).not.toBeNull();
  });

  it("notifies subscribers on chrome writes and clear", () => {
    const listener = vi.fn();
    const unsub = subscribePreview(listener);
    setDropGhost({
      valid: true,
      startTime: 0,
      track: "main",
      laneId: "base",
      isInsert: false,
      insertOrder: null,
      indicatorTop: 0,
      ghostWidthPx: 40,
      ghostHeightPx: 40,
      contentTop: 10,
      label: "x",
    });
    setMarquee({ left: 0, top: 0, right: 10, bottom: 10 });
    clearPreviewSession();
    unsub();
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(getPreviewSession()).toEqual({
      dropGhost: null,
      clipMovePreview: null,
      marquee: null,
    });
  });
});
