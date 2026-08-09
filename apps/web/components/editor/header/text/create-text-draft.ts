import { DEFAULT_FRAME_DURATION, type FrameDraft } from "@motionvideo/editor-core";
import type { TextDragPayload, TextPreset } from "./types";

export function createTextDraft(input: {
  presetId?: string;
  label: string;
  text: string;
}): FrameDraft {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `text.${crypto.randomUUID()}`
      : `text.${input.presetId ?? "preset"}.${Date.now()}`;
  return {
    id,
    name: input.label,
    role: "text",
    kind: "text",
    duration: DEFAULT_FRAME_DURATION,
    text: input.text,
  };
}

export function draftFromTextPreset(preset: TextPreset): FrameDraft {
  return createTextDraft({
    presetId: preset.id,
    label: preset.label,
    text: preset.text,
  });
}

export function draftFromTextDragPayload(payload: TextDragPayload): FrameDraft {
  return createTextDraft({
    presetId: payload.presetId,
    label: payload.label,
    text: payload.text,
  });
}
