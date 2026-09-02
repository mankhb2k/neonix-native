/**
 * Returns the maximum timeline duration available from a video source.
 *
 * The timeline policy receives normalized seconds from the editor boundary.
 * Protocol V2 stores the corresponding source and trim values in milliseconds.
 * The source range is half-open and is bounded by trimEnd (when present) or
 * the probed source duration. A video layer never repeats its source to
 * satisfy a longer timeline duration.
 */
export function getVideoTimelineDurationLimit(input: {
  sourceDuration?: number;
  trimStart?: number;
  trimEnd?: number;
  playbackRate?: number;
}): number | undefined {
  const sourceDuration = input.sourceDuration;
  if (sourceDuration === undefined || !Number.isFinite(sourceDuration) || sourceDuration <= 0) {
    return undefined;
  }

  const trimStart = input.trimStart ?? 0;
  const trimEnd = input.trimEnd ?? sourceDuration;
  const playbackRate = input.playbackRate ?? 1;
  if (
    !Number.isFinite(trimStart) || trimStart < 0
    || !Number.isFinite(trimEnd) || trimEnd <= trimStart
    || !Number.isFinite(playbackRate) || playbackRate <= 0
  ) {
    return undefined;
  }

  return Math.max(0, (Math.min(sourceDuration, trimEnd) - trimStart) / playbackRate);
}
