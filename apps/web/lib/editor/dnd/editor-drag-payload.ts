import type { FrameDraft } from "@/lib/editor/frame-library";
import { FRAME_LIBRARY_MIME } from "@/lib/editor/frame-library";

/** MIME audio library — dùng chung sidebar + timeline drop. */
export const AUDIO_LIBRARY_MIME = "application/x-moticlip-audio";

export { FRAME_LIBRARY_MIME };

export type EditorLibraryDragItem =
  | {
      type: "frame";
      id: string;
      name: string;
      duration: number;
      draft?: FrameDraft;
    }
  | {
      type: "audio";
      id: string;
      name: string;
      duration: number;
      title?: string;
    };

/** Chuẩn hóa duration từ payload audio (string mm:ss hoặc số giây). */
export function normalizeAudioDurationSec(duration: unknown): number {
  if (typeof duration === "number" && Number.isFinite(duration)) {
    return Math.max(0.5, duration);
  }
  if (typeof duration === "string") {
    const parts = duration.split(":").map(Number);
    if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
      return Math.max(0.5, parts[0] * 60 + parts[1]);
    }
    const asNum = Number(duration);
    if (Number.isFinite(asNum)) return Math.max(0.5, asNum);
  }
  return 10;
}

export function parseAudioLibraryPayload(raw: string): {
  id: string;
  title: string;
  duration: number;
} | null {
  try {
    const parsed = JSON.parse(raw) as {
      id?: string;
      title?: string;
      duration?: string | number;
    };
    if (!parsed || typeof parsed !== "object") return null;
    return {
      id: typeof parsed.id === "string" ? parsed.id : `audio_${Date.now().toString(36)}`,
      title: typeof parsed.title === "string" ? parsed.title : "Âm thanh",
      duration: normalizeAudioDurationSec(parsed.duration),
    };
  } catch {
    return null;
  }
}
