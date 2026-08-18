import { describe, expect, it } from "vitest";
import {
  buildClipMovePatch,
  createClipMoveSessionState,
  updateClipMoveSessionState,
} from "../timeline/clip-move-session";
import {
  buildPlacementTarget,
  createLibraryDropSessionState,
  updateLibraryDropSessionState,
} from "../timeline/library-drop-session";

describe("buildClipMovePatch", () => {
  it("maps session state to a move patch", () => {
    const state = createClipMoveSessionState("c1", 2, "lane-main", "main");
    const updated = updateClipMoveSessionState(
      state,
      5.5,
      "lane-overlay",
      "overlay",
      true,
      3,
    );
    expect(buildClipMovePatch(updated)).toEqual({
      startTime: 5.5,
      track: "overlay",
      laneId: "lane-overlay",
      insertNewLane: true,
      insertOrder: 3,
    });
  });

  it("clamps negative start time to zero", () => {
    const state = createClipMoveSessionState("c1", 2, "lane-main", "main");
    const updated = updateClipMoveSessionState(state, -4, "lane-main");
    expect(buildClipMovePatch(updated).startTime).toBe(0);
  });
});

describe("buildPlacementTarget", () => {
  it("emits a null lane target for the initial drop state", () => {
    const state = createLibraryDropSessionState(
      "frame",
      "item-1",
      "Item 1",
      3,
      "main",
    );
    const target = buildPlacementTarget(state);
    expect(target).toEqual({
      track: "main",
      laneId: null,
      startTime: 0,
      insertNewLane: false,
      insertOrder: null,
    });
  });

  it("emits an insert-lane target after update", () => {
    const state = createLibraryDropSessionState(
      "audio",
      "audio-1",
      "Music",
      6,
      "audio",
    );
    const updated = updateLibraryDropSessionState(
      state,
      4.5,
      "lane-new",
      "audio",
      true,
      2,
    );
    expect(buildPlacementTarget(updated)).toEqual({
      track: "audio",
      laneId: "lane-new",
      startTime: 4.5,
      insertNewLane: true,
      insertOrder: 2,
    });
  });
});
