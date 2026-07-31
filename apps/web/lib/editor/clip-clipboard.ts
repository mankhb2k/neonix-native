import type { MotionScene } from "@motionvideo/motion-schema";

export type ClipClipboardKind = "main" | "overlay" | "audio";

/** Serializable clipboard payload for timeline clips (editor-internal). */
export type ClipClipboardItem = {
  kind: ClipClipboardKind;
  name: string;
  duration: number;
  /** Offset from the leftmost copied clip's startTime. */
  offsetStart: number;
  /** Deep-cloned main scene (ids reassigned on paste). */
  scene?: MotionScene;
  /** Audio asset id for audio clips. */
  audioAssetId?: string;
};

export const MIN_CLIP_SLICE_SEC = 0.05;

export function playheadSplitsClip(
  clip: { startTime: number; duration: number },
  playhead: number,
): boolean {
  const start = clip.startTime;
  const end = start + clip.duration;
  return (
    playhead > start + MIN_CLIP_SLICE_SEC &&
    playhead < end - MIN_CLIP_SLICE_SEC
  );
}
