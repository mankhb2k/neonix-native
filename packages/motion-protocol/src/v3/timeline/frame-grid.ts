/**
 * Frame-grid — snap và validate thời gian timeline về lưới `n / fps`.
 */

const FRAME_GRID_EPSILON = 1e-9;

export function secondsToFrameIndex(seconds: number, fps: number): number {
  const safeFps = Math.max(1, fps);
  return Math.round(seconds * safeFps);
}

export function snapSecondsToFrameGrid(seconds: number, fps: number): number {
  const safeFps = Math.max(1, fps);
  return secondsToFrameIndex(seconds, safeFps) / safeFps;
}

export function isOnFrameGrid(seconds: number, fps: number): boolean {
  const safeFps = Math.max(1, fps);
  const scaled = seconds * safeFps;
  return Math.abs(scaled - Math.round(scaled)) <= FRAME_GRID_EPSILON;
}

export interface FrameGridIssue {
  path: (string | number)[];
  message: string;
  value: number;
  expected: number;
}

function checkOnGrid(
  value: number | undefined,
  fps: number,
  path: (string | number)[],
  issues: FrameGridIssue[],
): void {
  if (value === undefined || !Number.isFinite(value)) return;
  if (isOnFrameGrid(value, fps)) return;
  const expected = snapSecondsToFrameGrid(value, fps);
  issues.push({
    path,
    message: `Value ${value} is off the ${fps}fps frame grid (expected ${expected})`,
    value,
    expected,
  });
}

function snapOptional(value: number | undefined, fps: number): number | undefined {
  if (value === undefined) return undefined;
  return snapSecondsToFrameGrid(value, fps);
}

/**
 * Snap mọi field timing của timeline lên frame-grid của composition.
 */
export function snapTimelineToFrameGrid<T extends Record<string, unknown>>(
  timeline: T,
  fps: number,
): T {
  const safeFps = Math.max(1, fps);
  const next = { ...timeline } as T & {
    duration?: number;
    visualTracks?: Array<Record<string, unknown>>;
    audioTracks?: Array<Record<string, unknown>>;
    captionTracks?: Array<Record<string, unknown>>;
    workArea?: { start: number; end: number };
    markers?: Array<Record<string, unknown>>;
  };

  if (next.duration !== undefined) {
    next.duration = snapSecondsToFrameGrid(next.duration, safeFps);
  }

  if (next.workArea) {
    next.workArea = {
      start: snapSecondsToFrameGrid(next.workArea.start, safeFps),
      end: snapSecondsToFrameGrid(next.workArea.end, safeFps),
    };
  }

  if (Array.isArray(next.markers)) {
    next.markers = next.markers.map((marker) => ({
      ...marker,
      t:
        typeof marker.t === "number"
          ? snapSecondsToFrameGrid(marker.t, safeFps)
          : marker.t,
    }));
  }

  if (Array.isArray(next.visualTracks)) {
    next.visualTracks = next.visualTracks.map((track) => {
      const clips = Array.isArray(track.clips)
        ? (track.clips as Array<Record<string, unknown>>).map((clip) => ({
            ...clip,
            start:
              typeof clip.start === "number"
                ? snapSecondsToFrameGrid(clip.start, safeFps)
                : clip.start,
            duration:
              typeof clip.duration === "number"
                ? snapSecondsToFrameGrid(clip.duration, safeFps)
                : clip.duration,
            trimStart: snapOptional(
              clip.trimStart as number | undefined,
              safeFps,
            ),
          }))
        : track.clips;
      return { ...track, clips };
    });
  }

  if (Array.isArray(next.audioTracks)) {
    next.audioTracks = next.audioTracks.map((track) => {
      const clips = Array.isArray(track.clips)
        ? (track.clips as Array<Record<string, unknown>>).map((clip) => ({
            ...clip,
            start:
              typeof clip.start === "number"
                ? snapSecondsToFrameGrid(clip.start, safeFps)
                : clip.start,
            duration:
              typeof clip.duration === "number"
                ? snapSecondsToFrameGrid(clip.duration, safeFps)
                : clip.duration,
            trimStart: snapOptional(
              clip.trimStart as number | undefined,
              safeFps,
            ),
            trimEnd: snapOptional(clip.trimEnd as number | undefined, safeFps),
            fadeIn: snapOptional(clip.fadeIn as number | undefined, safeFps),
            fadeOut: snapOptional(clip.fadeOut as number | undefined, safeFps),
          }))
        : track.clips;
      return { ...track, clips };
    });
  }

  if (Array.isArray(next.captionTracks)) {
    next.captionTracks = next.captionTracks.map((track) => {
      const tokens = Array.isArray(track.tokens)
        ? (track.tokens as Array<Record<string, unknown>>).map((token) => ({
            ...token,
            start:
              typeof token.start === "number"
                ? snapSecondsToFrameGrid(token.start, safeFps)
                : token.start,
            end:
              typeof token.end === "number"
                ? snapSecondsToFrameGrid(token.end, safeFps)
                : token.end,
          }))
        : track.tokens;
      return { ...track, tokens };
    });
  }

  return next;
}

/**
 * Thu thập lỗi timing lệch frame-grid cho timeline ở `fps` cho trước.
 */
export function collectFrameGridIssues(
  timeline: {
    duration?: number;
    workArea?: { start: number; end: number };
    markers?: ReadonlyArray<{ id: string; t: number }>;
    visualTracks: ReadonlyArray<{
      id: string;
      clips: ReadonlyArray<{
        id: string;
        start: number;
        duration: number;
        trimStart?: number;
      }>;
    }>;
    audioTracks: ReadonlyArray<{
      id: string;
      clips: ReadonlyArray<{
        id: string;
        start: number;
        duration: number;
        trimStart?: number;
        trimEnd?: number;
        fadeIn?: number;
        fadeOut?: number;
      }>;
    }>;
    captionTracks: ReadonlyArray<{
      id: string;
      tokens: ReadonlyArray<{ id: string; start: number; end: number }>;
    }>;
  },
  fps: number,
): FrameGridIssue[] {
  const safeFps = Math.max(1, fps);
  const issues: FrameGridIssue[] = [];

  checkOnGrid(timeline.duration, safeFps, ["duration"], issues);
  if (timeline.workArea) {
    checkOnGrid(timeline.workArea.start, safeFps, ["workArea", "start"], issues);
    checkOnGrid(timeline.workArea.end, safeFps, ["workArea", "end"], issues);
  }
  for (const marker of timeline.markers ?? []) {
    checkOnGrid(marker.t, safeFps, ["markers", marker.id, "t"], issues);
  }

  for (const track of timeline.visualTracks) {
    for (const clip of track.clips) {
      const base = ["visualTracks", track.id, "clips", clip.id] as (
        | string
        | number
      )[];
      checkOnGrid(clip.start, safeFps, [...base, "start"], issues);
      checkOnGrid(clip.duration, safeFps, [...base, "duration"], issues);
      checkOnGrid(clip.trimStart, safeFps, [...base, "trimStart"], issues);
    }
  }

  for (const track of timeline.audioTracks) {
    for (const clip of track.clips) {
      const base = ["audioTracks", track.id, "clips", clip.id] as (
        | string
        | number
      )[];
      checkOnGrid(clip.start, safeFps, [...base, "start"], issues);
      checkOnGrid(clip.duration, safeFps, [...base, "duration"], issues);
      checkOnGrid(clip.trimStart, safeFps, [...base, "trimStart"], issues);
      checkOnGrid(clip.trimEnd, safeFps, [...base, "trimEnd"], issues);
      checkOnGrid(clip.fadeIn, safeFps, [...base, "fadeIn"], issues);
      checkOnGrid(clip.fadeOut, safeFps, [...base, "fadeOut"], issues);
    }
  }

  for (const track of timeline.captionTracks) {
    for (const token of track.tokens) {
      const base = ["captionTracks", track.id, "tokens", token.id] as (
        | string
        | number
      )[];
      checkOnGrid(token.start, safeFps, [...base, "start"], issues);
      checkOnGrid(token.end, safeFps, [...base, "end"], issues);
    }
  }

  return issues;
}
