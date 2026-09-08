import type { EditorIntent } from "../commands/editor-intents";

export type EditorKeyboardInput = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

/** Maps normalized keyboard data to editor intent; it does not read the DOM. */
export function editorIntentFromShortcut(
  input: EditorKeyboardInput,
): EditorIntent | null {
  if (input.altKey) return null;
  const commandKey = Boolean(input.ctrlKey || input.metaKey);
  const key = input.key.toLowerCase();

  if (commandKey && key === "z") {
    return input.shiftKey ? { type: "redo" } : { type: "undo" };
  }
  if (commandKey && key === "y") return { type: "redo" };
  if (input.key === "Delete" || input.key === "Backspace") {
    return { type: "delete-selection" };
  }
  return null;
}
