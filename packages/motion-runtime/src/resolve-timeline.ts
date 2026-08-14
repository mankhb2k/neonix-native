import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import { ROOT_LAYER_GRAPH_ID } from "./layer-graph";

export type TimelineProjectLike = {
  timeline: {
    /** Explicit final MP4 length (compiler canonicalization). */
    duration: number;
  };
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
 * Ordered segments on the global timeline.
 *
 * Layer-graph IR has one window: `[0, timeline.duration)`.
 */
export function listTimelineSegments(
  runtime: TimelineProjectLike,
): TimelineSceneSegment[] {
  const duration = runtime.timeline.duration;
  if (!(duration > 0)) return [];
  return [
    {
      sceneId: ROOT_LAYER_GRAPH_ID,
      start: 0,
      duration,
      trackOrder: 0,
    },
  ];
}

export function timelineTotalDuration(runtime: TimelineProjectLike): number {
  return runtime.timeline.duration;
}

/**
 * Map global playhead time → active layer graph + local time.
 *
 * Empty tail and past-end return `null`.
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

  const segment = segments[0]!;
  const end = segment.start + segment.duration;
  if (t < segment.start || t >= end) return null;

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
    sceneIndex: 0,
  };
}

/** @deprecated Prefer TimelineProjectLike — kept for call-site clarity. */
export type TimelineRuntime = MotionRuntimeProject;
