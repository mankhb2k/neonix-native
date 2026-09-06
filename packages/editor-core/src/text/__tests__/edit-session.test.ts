import { describe, expect, it } from "vitest";
import {
  clampTextSelection,
  createTextEditSession,
  textEditChanged,
  updateTextEditDraft,
} from "../edit-session";
import type { V2TextLayer } from "@motionvideo/motion-protocol/v2";

const layer = {
  id: "title",
  type: "text",
  parentLayerId: null,
  order: 0,
  frame: { width: 320, height: 80 },
  transform: {
    translate: { x: 0, y: 0 },
    rotate: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1 },
    anchor: { x: 0, y: 0 },
  },
  timing: { start: 0, duration: 5 },
  payload: {
    source: { text: "Hello", language: "en" },
    chunks: [{
      id: "chunk",
      sourceRange: { start: 0, end: 5 },
      spans: [{
        id: "span",
        sourceRange: { start: 0, end: 5 },
        font: { family: "Noto Sans", size: 32, weight: 400, style: "normal" },
      }],
    }],
  },
} as V2TextLayer;

describe("text edit session", () => {
  it("captures the original text and places the caret at the end", () => {
    const session = createTextEditSession(layer);
    expect(session.before.text).toBe("Hello");
    expect(session.selection).toEqual({ start: 5, end: 5 });
    expect(textEditChanged(session)).toBe(false);
  });

  it("clamps and normalizes reversed selections", () => {
    expect(clampTextSelection({ start: 99, end: -2 }, 5)).toEqual({ start: 0, end: 5 });
  });

  it("keeps one draft session until commit", () => {
    const session = updateTextEditDraft(createTextEditSession(layer), "Hi", { start: 1, end: 1 });
    expect(session.before.text).toBe("Hello");
    expect(session.draftText).toBe("Hi");
    expect(session.selection).toEqual({ start: 1, end: 1 });
    expect(textEditChanged(session)).toBe(true);
  });
});
