import type { ReactNode } from "react";

export type TextPreset = {
  id: string;
  label: string;
  /** Nội dung mặc định khi thêm lên board. */
  text: string;
  /** Preview trong dropdown. */
  preview: ReactNode;
};

export type TextCategory = {
  title: string;
  items: TextPreset[];
};

export const MOTICLIP_TEXT_MIME = "application/x-moticlip-text";

export type TextDragPayload = {
  presetId: string;
  label: string;
  text: string;
};

export function serializeTextDrag(payload: TextDragPayload): string {
  return JSON.stringify(payload);
}

export function parseTextDrag(raw: string): TextDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as TextDragPayload;
    if (!parsed?.label || typeof parsed.text !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
