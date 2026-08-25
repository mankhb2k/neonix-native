import {
  DEFAULT_FRAME_DURATION,
  type FrameDraft,
  type FrameDraftShape,
} from "@motionvideo/editor-core/timeline";
import type { ShapeDragPayload, ShapePreset } from "./types";

export function createShapeDraft(input: {
  presetId?: string;
  label: string;
  shape: FrameDraftShape;
}): FrameDraft {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `shape.${crypto.randomUUID()}`
      : `shape.${input.presetId ?? "preset"}.${Date.now()}`;
  return {
    id,
    name: input.label,
    role: "shape",
    kind: "shape",
    shape: input.shape,
    duration: DEFAULT_FRAME_DURATION,
    text: input.label,
  };
}

export function draftFromPreset(preset: ShapePreset): FrameDraft {
  return createShapeDraft({
    presetId: preset.id,
    label: preset.label,
    shape: preset.shape,
  });
}

export function draftFromDragPayload(payload: ShapeDragPayload): FrameDraft {
  return createShapeDraft({
    presetId: payload.presetId,
    label: payload.label,
    shape: payload.shape,
  });
}
