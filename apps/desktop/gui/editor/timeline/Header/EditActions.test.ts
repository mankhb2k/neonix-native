import { describe, expect, it } from "vitest";
import { MIN_CLIP_SLICE_SEC } from "@motionvideo/editor-core";
import { canSplitSelectedClips } from "./EditActions";

describe("canSplitSelectedClips", () => {
  const clipsById = new Map([
    ["a", { startTime: 1, duration: 4 }],
    ["b", { startTime: 10, duration: 2 }],
  ]);

  it("is true when playhead is interior to a selected clip", () => {
    expect(canSplitSelectedClips(["a"], clipsById, 2)).toBe(true);
  });

  it("is false near clip edges within MIN_CLIP_SLICE_SEC", () => {
    expect(
      canSplitSelectedClips(["a"], clipsById, 1 + MIN_CLIP_SLICE_SEC),
    ).toBe(false);
    expect(
      canSplitSelectedClips(["a"], clipsById, 5 - MIN_CLIP_SLICE_SEC),
    ).toBe(false);
  });

  it("is false for missing ids and empty selection", () => {
    expect(canSplitSelectedClips(["missing"], clipsById, 2)).toBe(false);
    expect(canSplitSelectedClips([], clipsById, 2)).toBe(false);
  });

  it("checks any selected id via Map lookup", () => {
    expect(canSplitSelectedClips(["missing", "b"], clipsById, 11)).toBe(true);
    expect(canSplitSelectedClips(["a", "b"], clipsById, 0)).toBe(false);
  });
});
