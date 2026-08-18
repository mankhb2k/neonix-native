import { describe, expect, it } from "vitest";
import { placementFromLibraryDropGhost } from "../library/timeline-library-drop";

describe("placementFromLibraryDropGhost", () => {
  it("lands any visual type on Main when over the base body", () => {
    expect(
      placementFromLibraryDropGhost({
        valid: true,
        isInsert: false,
        track: "main",
        overBaseBody: true,
        laneId: null,
        insertOrder: null,
        startTime: 1.25,
      }),
    ).toEqual({ track: "main", startTime: 1.25 });
  });

  it("does not treat a null Main laneId as overlay insert", () => {
    const placement = placementFromLibraryDropGhost({
      valid: true,
      isInsert: false,
      track: "overlay",
      overBaseBody: true,
      laneId: null,
      insertOrder: 0,
      startTime: 0,
    });
    expect(placement).toEqual({ track: "main", startTime: 0 });
  });

  it("creates an overlay lane only on explicit insert-above", () => {
    expect(
      placementFromLibraryDropGhost({
        valid: true,
        isInsert: true,
        track: "overlay",
        overBaseBody: false,
        laneId: null,
        insertOrder: 0,
        startTime: 2,
      }),
    ).toEqual({
      track: "overlay",
      insertNewLane: true,
      insertOrder: 0,
      startTime: 2,
    });
  });

  it("keeps an existing overlay lane when dropped on its body", () => {
    expect(
      placementFromLibraryDropGhost({
        valid: true,
        isInsert: false,
        track: "overlay",
        overBaseBody: false,
        laneId: "lane.overlay.0",
        insertOrder: null,
        startTime: 0.5,
      }),
    ).toEqual({
      track: "overlay",
      laneId: "lane.overlay.0",
      startTime: 0.5,
    });
  });
});
