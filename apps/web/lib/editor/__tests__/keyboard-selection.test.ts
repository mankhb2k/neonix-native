import { describe, expect, it } from "vitest";
import { updateKeyboardSelection } from "@motionvideo/editor-core";

describe("keyboard selection", () => {
  const order = ["layer-0", "layer-1", "layer-2", "layer-3", "layer-4"];

  it("selects the inclusive range from the focused layer on Shift click", () => {
    expect(updateKeyboardSelection(order, ["layer-1"], "layer-3", { shiftKey: true })).toEqual([
      "layer-1",
      "layer-2",
      "layer-3",
    ]);
    expect(updateKeyboardSelection(order, ["layer-3"], "layer-1", { shiftKey: true })).toEqual([
      "layer-1",
      "layer-2",
      "layer-3",
    ]);
  });

  it("toggles one layer with Ctrl/Cmd click", () => {
    expect(updateKeyboardSelection(order, ["layer-1", "layer-3"], "layer-2", { additiveKey: true })).toEqual([
      "layer-1",
      "layer-3",
      "layer-2",
    ]);
    expect(updateKeyboardSelection(order, ["layer-1", "layer-2"], "layer-2", { additiveKey: true })).toEqual(["layer-1"]);
  });

  it("falls back to a single target when Shift has no valid anchor", () => {
    expect(updateKeyboardSelection(order, [], "layer-2", { shiftKey: true })).toEqual(["layer-2"]);
  });
});
