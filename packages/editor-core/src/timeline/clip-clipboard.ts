import type { MotionLayer } from "@motionvideo/motion-protocol";

export type ClipClipboardKind = "main" | "overlay" | "audio";

/** Payload clipboard tuần tự cho timeline clip (nội bộ editor). */
export type ClipClipboardItem = {
  kind: ClipClipboardKind;
  name: string;
  duration: number;
  /** Offset so với startTime của clip sao chép ngoài cùng bên trái. */
  offsetStart: number;
  /** Layer main được clone sâu (id gán lại khi paste). */
  scene?: MotionLayer;
  /** Asset id cho audio clip. */
  audioAssetId?: string;
  /** Giữ ngữ nghĩa audio layer khi sao chép audio clip. */
  trimStart?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
  audioRole?: "bgm" | "sfx" | "voiceover";
};

export const MIN_CLIP_SLICE_SEC = 0.05;

export function playheadSplitsClip(
  clip: { startTime: number; duration: number },
  playhead: number,
): boolean {
  const start = clip.startTime;
  const end = start + clip.duration;
  return (
    playhead > start + MIN_CLIP_SLICE_SEC && playhead < end - MIN_CLIP_SLICE_SEC
  );
}
