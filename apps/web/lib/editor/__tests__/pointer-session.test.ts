import { describe, expect, it } from "vitest";
import {
  selectionIdsEqual,
  shouldCommitPointerSession,
} from "@/lib/editor/__tests__/pointer-session-contract";

describe("UX-02 pointer session contract", () => {
  it("commits only on pointerup", () => {
    expect(shouldCommitPointerSession("pointerup")).toBe(true);
    expect(shouldCommitPointerSession("pointercancel")).toBe(false);
    expect(shouldCommitPointerSession("escape")).toBe(false);
  });

  it("compares marquee selection sets without order sensitivity", () => {
    expect(selectionIdsEqual(["a", "b"], ["b", "a"])).toBe(true);
    expect(selectionIdsEqual(["a"], ["a", "b"])).toBe(false);
  });
});
