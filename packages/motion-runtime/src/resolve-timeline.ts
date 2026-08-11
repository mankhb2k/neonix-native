import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";

export type TimelineProjectLike = {
  timeline: {
    /** V3 visual tracks — the sole source of timeline ordering. */
    visualTracks: ReadonlyArray<{
      role: string;
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
};

/**
 * Ordered scene segments on the global timeline (hard cuts, no transition overlap).
 *
 * Phase 7: resolves exclusively from the primary visualTracks track (V3 model).
 */
export function listTimelineSegments(
  runtime: TimelineProjectLike,
): TimelineSceneSegment[] {
  const byId = new Map(runtime.scenes.map((scene) => [scene.id, scene]));

  // Phase 7: visualTracks primary track is the sole source
  const primaryTrack = runtime.timeline.visualTracks.find(
    (t) => t.role === "primary",
  );
  if (!primaryTrack || primaryTrack.clips.length === 0) {
    return [];
  }
  const sortedClips = [...primaryTrack.clips].sort((a, b) => a.start - b.start);
  return sortedClips.map((clip) => {
    const sourceId =
      clip.source.kind === "scene"
        ? clip.source.sceneId
        : clip.source.componentId;
    const scene = sourceId ? byId.get(sourceId) : undefined;
    return {
      sceneId: sourceId ?? "",
      name: scene?.name,
      start: clip.start,
      duration: clip.duration,
    };
  });
}

export function timelineTotalDuration(runtime: TimelineProjectLike): number {
  return listTimelineSegments(runtime).reduce(
    (sum, segment) => sum + segment.duration,
    0,
  );
}

/**
 * Map global playhead time → active scene + local time (hard cut).
 * Clamps to the last frame of the last scene when past the end.
 */
export function resolveTimelineAtTime(
  runtime: TimelineProjectLike,
  globalTime: number,
): TimelineResolveResult | null {
  const segments = listTimelineSegments(runtime);
  if (segments.length === 0) return null;

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  const t = Number.isFinite(globalTime) ? Math.max(0, globalTime) : 0;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!;
    const end = segment.start + segment.duration;
    const isLast = i === segments.length - 1;
    if (t < end || (isLast && t >= segment.start)) {
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
        sceneIndex: i,
      };
    }
  }

  const last = segments[segments.length - 1]!;
  return {
    sceneId: last.sceneId,
    localTime: Math.max(0, last.duration - 1e-6),
    sceneStart: last.start,
    sceneDuration: last.duration,
    totalDuration,
    sceneIndex: segments.length - 1,
  };
}

/** @deprecated Prefer TimelineProjectLike — kept for call-site clarity. */
export type TimelineRuntime = MotionRuntimeProject;
