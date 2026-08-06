/**
 * Deterministic media frame rounding shared by Pixi preview + Remotion export.
 */

export type MediaTimingInput = {
  mediaTimeSeconds: number;
  fps: number;
  /** Optional trim window in seconds on the source. */
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  playbackRate?: number;
  loop?: boolean;
  sourceDurationSeconds?: number;
};

export type MediaTimingResult = {
  /** Clamped source time in seconds after trim/rate/loop. */
  mediaTimeSeconds: number;
  /** Frame index into the source at fps (trimBefore for OffthreadVideo). */
  sourceFrame: number;
};

/**
 * Round evaluated mediaTime into a stable source frame.
 * Policy: round half-up via Math.round after applying trim + rate + loop.
 */
export function resolveMediaTiming(input: MediaTimingInput): MediaTimingResult {
  const fps = Math.max(1, input.fps);
  const rate = Math.max(0.01, input.playbackRate ?? 1);
  const trimStart = Math.max(0, input.trimStartSeconds ?? 0);
  let t = Math.max(0, input.mediaTimeSeconds) * rate + trimStart;

  if (
    input.loop &&
    input.sourceDurationSeconds &&
    input.sourceDurationSeconds > 0
  ) {
    const span = Math.max(
      1 / fps,
      (input.trimEndSeconds ?? input.sourceDurationSeconds) - trimStart,
    );
    t = trimStart + ((t - trimStart) % span);
  } else if (input.trimEndSeconds !== undefined) {
    t = Math.min(t, input.trimEndSeconds);
  } else if (input.sourceDurationSeconds !== undefined) {
    t = Math.min(t, Math.max(0, input.sourceDurationSeconds - 1 / fps));
  }

  const sourceFrame = Math.max(0, Math.round(t * fps));
  return {
    mediaTimeSeconds: t,
    sourceFrame,
  };
}

/** Font preload policy for Remotion delayRender / Pixi Assets.load. */
export type FontPreloadRequest = {
  family: string;
  uri: string;
  weight?: number;
  style?: "normal" | "italic";
};

export function fontPreloadKey(req: FontPreloadRequest): string {
  return `${req.family}:${req.weight ?? 400}:${req.style ?? "normal"}:${req.uri}`;
}
