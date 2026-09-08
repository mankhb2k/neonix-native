import { describe, expect, it } from "vitest";
import { editorIntentFromShortcut } from "../../src/keyboard/editor-shortcuts";

describe("editor shortcuts", () => {
  it("maps undo and redo without depending on browser event types", () => {
    expect(editorIntentFromShortcut({ key: "z", ctrlKey: true })).toEqual({ type: "undo" });
    expect(editorIntentFromShortcut({ key: "z", metaKey: true, shiftKey: true })).toEqual({ type: "redo" });
    expect(editorIntentFromShortcut({ key: "y", ctrlKey: true })).toEqual({ type: "redo" });
  });

  it("maps deletion and ignores alternate shortcuts", () => {
    expect(editorIntentFromShortcut({ key: "Delete" })).toEqual({ type: "delete-selection" });
    expect(editorIntentFromShortcut({ key: "Backspace" })).toEqual({ type: "delete-selection" });
    expect(editorIntentFromShortcut({ key: "z", ctrlKey: true, altKey: true })).toBeNull();
  });
});
