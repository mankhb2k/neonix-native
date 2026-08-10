import type { MotionProject } from "@motionvideo/motion-protocol";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol";

export type TimelineProjectLike = {
  timeline: {
    sceneOrder: readonly string[];
    /** Phase 5: V3 visual tracks — preferred over sceneOrder when present. */
    visualTracks?: ReadonlyArray<{
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
 * Phase 5: prefers the primary `visualTracks` track when available (V3 model).
 * Falls back to `sceneOrder` for legacy runtime IR.
 */
export function listTimelineSegments(
  runtime: TimelineProjectLike,
): TimelineSceneSegment[] {
  const byId = new Map(runtime.scenes.map((scene) => [scene.id, scene]));

  // Phase 5: prefer visualTracks primary track (V3 model)
  const primaryTrack = runtime.timeline.visualTracks?.find(
    (t) => t.role === "primary",
  );
  if (primaryTrack && primaryTrack.clips.length > 0) {
    const sortedClips = [...primaryTrack.clips].sort(
      (a, b) => a.start - b.start,
    );
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

  // Legacy fallback: sceneOrder (V2 model)
  const order =
    runtime.timeline.sceneOrder.length > 0
      ? runtime.timeline.sceneOrder
      : runtime.scenes.map((scene) => scene.id);

  const segments: TimelineSceneSegment[] = [];
  let cursor = 0;
  for (const sceneId of order) {
    const scene = byId.get(sceneId);
    if (!scene) continue;
    const duration = Math.max(0, scene.duration ?? 0);
    segments.push({
      sceneId,
      name: scene.name,
      start: cursor,
      duration,
    });
    cursor += duration;
  }
  return segments;
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
export type TimelineRuntime = MotionRuntimeProject | MotionProject;
