import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";

export type TimelineProjectLike = {
  timeline: {
    /** Explicit final MP4 length (compiler canonicalization). */
    duration?: number;
    /** V1 visual tracks — stacking by `order` (unique). */
    visualTracks: ReadonlyArray<{
      order: number;
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
  /** Visual track stacking order (higher draws on top / wins resolve). */
  trackOrder: number;
};

/**
 * Ordered scene segments on the global timeline.
 *
 * Includes clips from ALL visual tracks. Sorted by start, then track order.
 */
export function listTimelineSegments(
  runtime: TimelineProjectLike,
): TimelineSceneSegment[] {
  const byId = new Map(runtime.scenes.map((scene) => [scene.id, scene]));
  const allClips: Array<{
    source: { kind: string; sceneId?: string; componentId?: string };
    start: number;
    duration: number;
    trackOrder: number;
  }> = [];
  for (const track of runtime.timeline.visualTracks) {
    for (const clip of track.clips) {
      allClips.push({ ...clip, trackOrder: track.order });
    }
  }
  if (allClips.length === 0) return [];
  const sorted = [...allClips].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.trackOrder - b.trackOrder;
  });
  return sorted.map((clip) => {
    const sourceId = clip.source.sceneId ?? "";
    const scene = sourceId ? byId.get(sourceId) : undefined;
    return {
      sceneId: sourceId,
      name: scene?.name,
      start: clip.start,
      duration: clip.duration,
      trackOrder: clip.trackOrder,
    };
  });
}

export function timelineTotalDuration(runtime: TimelineProjectLike): number {
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
 * Map global playhead time → active scene + local time.
 *
 * When multiple clips overlap, the **highest track.order** wins (topmost
 * layer). Empty tail and past-end return `null`.
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

  let best: { segment: TimelineSceneSegment; index: number } | null = null;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!;
    const end = segment.start + segment.duration;
    if (t < segment.start || t >= end) continue;
    if (!best) {
      best = { segment, index: i };
      continue;
    }
    if (segment.trackOrder > best.segment.trackOrder) {
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
