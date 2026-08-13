import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";

export type TimelineProjectLike = {
  timeline: {
    /** Explicit final MP4 length (compiler canonicalization). */
    duration?: number;
    /** V3 visual tracks — the sole source of timeline ordering. */
    visualTracks: ReadonlyArray<{
      role: "primary" | "overlay" | string;
      clips: ReadonlyArray<{
        source: { kind: string; sceneId?: string; componentId?: string };
        start: number;
        duration: number;
      }>;
    }>;
  };
  scenes: readonly {
    id: string;
    duration: number;
    name?: string;
  }[];
};

export type TimelineResolveResult = {
  sceneId: string;
  localTime: number;
  /** Absolute start of this scene on the global timeline. */
  sceneStart: number;
  sceneDuration: number;
  totalDuration: number;
  sceneIndex: number;
};

export type TimelineSceneSegment = {
  sceneId: string;
  name?: string;
  start: number;
  duration: number;
  trackRole: string;
};

const ROLE_PRIORITY: Record<string, number> = {
  background: 0,
  primary: 1,
  overlay: 2,
};

/**
 * Ordered scene segments on the global timeline (hard cuts, no transition overlap).
 *
 * Includes clips from ALL visual tracks (primary + overlay). Sorted by start,
 * then by role priority (primary before overlay at the same start) so
 * `resolveTimelineAtTime` can prefer primary.
 */
export function listTimelineSegments(
  runtime: TimelineProjectLike,
): TimelineSceneSegment[] {
  const byId = new Map(runtime.scenes.map((scene) => [scene.id, scene]));
  const allClips: Array<{
    source: { kind: string; sceneId?: string; componentId?: string };
    start: number;
    duration: number;
    trackRole: string;
  }> = [];
  for (const track of runtime.timeline.visualTracks) {
    for (const clip of track.clips) {
      allClips.push({ ...clip, trackRole: track.role });
    }
  }
  if (allClips.length === 0) return [];
  const sorted = [...allClips].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const pa = ROLE_PRIORITY[a.trackRole] ?? 1;
    const pb = ROLE_PRIORITY[b.trackRole] ?? 1;
    // Lower role priority number draws under; for resolve precedence we want
    // primary before overlay → sort primary first (lower number first).
    return pa - pb;
  });
  return sorted.map((clip) => {
    // Runtime clips are scene-only after compilation (components are
    // synthesized into scenes by the compiler).
    const sourceId = clip.source.sceneId ?? "";
    const scene = sourceId ? byId.get(sourceId) : undefined;
    return {
      sceneId: sourceId,
      name: scene?.name,
      start: clip.start,
      duration: clip.duration,
      trackRole: clip.trackRole,
    };
  });
}

export function timelineTotalDuration(runtime: TimelineProjectLike): number {
  // An explicit timeline.duration is the authoritative final MP4 length. It
  // may exceed the derived visual end (intentional empty tail) but never be
  // shorter (enforced by the compiler / canonical schema). Fall back to the
  // max visual clip end only for legacy runtime that predates duration.
  const declared = runtime.timeline.duration;
  if (declared !== undefined && declared > 0) return declared;
  const allClips = runtime.timeline.visualTracks.flatMap((t) => t.clips);
  if (allClips.length === 0) return 0;
  return allClips.reduce(
    (max, clip) => Math.max(max, clip.start + clip.duration),
    0,
  );
}

/**
 * Map global playhead time → active scene + local time (hard cut).
 *
 * When multiple clips overlap at the same time (e.g. overlay), the primary
 * track clip takes precedence. Falls back to overlay if no primary match.
 * Empty tail (`t` past last visual content but `< timeline.duration`) and
 * past-end times return `null` — never clamp to the last scene.
 */
export function resolveTimelineAtTime(
  runtime: TimelineProjectLike,
  globalTime: number,
): TimelineResolveResult | null {
  const segments = listTimelineSegments(runtime);
  if (segments.length === 0) return null;

  const totalDuration = timelineTotalDuration(runtime);
  const t = Number.isFinite(globalTime) ? Math.max(0, globalTime) : 0;

  if (totalDuration > 0 && t >= totalDuration) return null;

  // Prefer primary (and lower role priority) when multiple clips cover `t`.
  let best: { segment: TimelineSceneSegment; index: number } | null = null;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!;
    const end = segment.start + segment.duration;
    if (t < segment.start || t >= end) continue;
    if (!best) {
      best = { segment, index: i };
      continue;
    }
    const bestPri = ROLE_PRIORITY[best.segment.trackRole] ?? 1;
    const curPri = ROLE_PRIORITY[segment.trackRole] ?? 1;
    // Primary (1) beats overlay (2). Keep the first match within same role.
    if (curPri < bestPri) {
      best = { segment, index: i };
    }
  }

  if (!best) return null;

  const { segment, index } = best;
  const localTime = Math.min(
    Math.max(0, t - segment.start),
    Math.max(0, segment.duration - 1e-6),
  );
  return {
    sceneId: segment.sceneId,
    localTime,
    sceneStart: segment.start,
    sceneDuration: segment.duration,
    totalDuration,
    sceneIndex: index,
  };
}

/** @deprecated Prefer TimelineProjectLike — kept for call-site clarity. */
export type TimelineRuntime = MotionRuntimeProject;
