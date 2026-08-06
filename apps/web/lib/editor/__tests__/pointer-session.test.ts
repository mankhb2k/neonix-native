import { describe, expect, it } from "vitest";
import {
  selectionIdsEqual,
  shouldCommitPointerSession,
} from "@motionvideo/editor-interactions";

describe("UX-02 pointer session contract", () => {
  it("commits only on pointerup", () => {
    expect(shouldCommitPointerSession("pointerup")).toBe(true);
    expect(shouldCommitPointerSession("pointercancel")).toBe(false);
    expect(shouldCommitPointerSession("escape")).toBe(false);
  });

  it("compares marquee selection id lists in order", () => {
    expect(selectionIdsEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(selectionIdsEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(selectionIdsEqual(["a"], ["a", "b"])).toBe(false);
  });
});
