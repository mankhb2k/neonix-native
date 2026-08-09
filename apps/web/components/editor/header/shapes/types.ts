import type { ReactNode } from "react";
import type { FrameDraftShape } from "@motionvideo/editor-core";

export type ShapePreset = {
  id: string;
  label: string;
  shape: FrameDraftShape;
  icon: ReactNode;
};

export type ShapeCategory = {
  title: string;
  items: ShapePreset[];
};

export const MOTICLIP_SHAPE_MIME = "application/x-moticlip-shape";

export type ShapeDragPayload = {
  presetId: string;
  label: string;
  shape: FrameDraftShape;
};

export function serializeShapeDrag(payload: ShapeDragPayload): string {
  return JSON.stringify(payload);
}

export function parseShapeDrag(raw: string): ShapeDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as ShapeDragPayload;
    if (!parsed?.label || !parsed?.shape) return null;
    return parsed;
  } catch {
    return null;
  }
}
