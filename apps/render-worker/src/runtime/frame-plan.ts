import type { CompiledProject } from "../compiler";
import {
  frameTimestamp,
  resolveMediaTiming,
} from "@motionvideo/motion-runtime";

export type FrameJob = {
  frameIndex: number;
  sceneIndex: number;
  localTime: number;
  globalTime: number;
  layers: FrameLayer[];
};

export type FrameLayer = {
  sceneIndex: number;
  localTime: number;
  opacity: number;
};

// ── Visual clip helpers (V1 visualTracks model) ───────────────────────

type VisualClipLike = {
  start: number;
  duration: number;
  source: { kind: string; sceneId?: string; componentId?: string };
  opacity?: number;
  trimStart?: number;
  playbackRate?: number;
  loop?: boolean;
  /** Authored scene duration (source media length), not clip window. */
  sourceDuration?: number;
  transitionIn?: { type: string; duration?: number } | null;
  transitionOut?: { type: string; duration?: number } | null;
};

type VisualTrackLike = {
  role: string;
  order?: number;
  clips: VisualClipLike[];
};

/**
 * Render priority by track role. Overlay draws on top of primary, which
 * draws on top of background.
 */
const ROLE_PRIORITY: Record<string, number> = {
  background: 0,
  primary: 1,
  overlay: 2,
};

/** Opacity-ramp duration for a transition (fade / crossfade only). */
function transitionOverlap(
  transition: VisualClipLike["transitionOut"],
): number {
  if (!transition) return 0;
  return transition.type === "fade" || transition.type === "crossfade"
    ? (transition.duration ?? 0)
    : 0;
}

type OrderedClip = {
  clip: VisualClipLike;
  trackIndex: number;
  clipIndex: number;
};

/**
 * Flatten every visual track into a single deterministic bottom-to-top
 * render order: role priority (background < primary < overlay), then track
 * `order`, then track index, then clip `start`, then original clip index.
 *
 * Clip `start` is ABSOLUTE global timeline time — never reconstructed from a
 * cursor — so gaps, overlays, and non-zero first clips are preserved.
 */
function orderedClips(compiled: CompiledProject): OrderedClip[] {
  const tracks = compiled.timeline.visualTracks as VisualTrackLike[];
  const result: OrderedClip[] = [];
  tracks.forEach((track, trackIndex) => {
    track.clips.forEach((clip, clipIndex) => {
      result.push({ clip, trackIndex, clipIndex });
    });
  });
  return result.sort((a, b) => {
    const pa = ROLE_PRIORITY[tracks[a.trackIndex]!.role] ?? 1;
    const pb = ROLE_PRIORITY[tracks[b.trackIndex]!.role] ?? 1;
    if (pa !== pb) return pa - pb;
    const oa = tracks[a.trackIndex]!.order ?? 0;
    const ob = tracks[b.trackIndex]!.order ?? 0;
    if (oa !== ob) return oa - ob;
    if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
    if (a.clip.start !== b.clip.start) return a.clip.start - b.clip.start;
    return a.clipIndex - b.clipIndex;
  });
}

function resolveSceneIndex(
  compiled: CompiledProject,
  clip: VisualClipLike,
): number {
  // Runtime clips are scene-only after compilation.
  const sourceId = clip.source.sceneId;
  return sourceId ? compiled.scenes.findIndex((s) => s.id === sourceId) : -1;
}

function resolveSourceDuration(
  compiled: CompiledProject,
  clip: VisualClipLike,
): number {
  if (clip.sourceDuration !== undefined && clip.sourceDuration > 0) {
    return clip.sourceDuration;
  }
  const sourceId = clip.source.sceneId;
  if (!sourceId) return clip.duration;
  const scene = compiled.scenes.find((s) => s.id === sourceId);
  return scene?.duration ?? clip.duration;
}

function clipLocalTime(
  clip: VisualClipLike,
  compositionLocalTime: number,
  fps: number,
  sourceDurationSeconds: number,
): number {
  return resolveMediaTiming({
    mediaTimeSeconds: compositionLocalTime,
    fps,
    trimStartSeconds: clip.trimStart ?? 0,
    playbackRate: clip.playbackRate ?? 1,
    loop: clip.loop ?? false,
    sourceDurationSeconds,
  }).mediaTimeSeconds;
}

// ── Public API (unchanged signatures) ─────────────────────────────────

export function projectDuration(compiled: CompiledProject): number {
  // An explicit timeline.duration is the authoritative final MP4 length. It
  // may exceed the derived visual end (intentional empty tail) but never be
  // shorter (enforced by the compiler). Fall back to the max clip end across
  // all tracks when duration is absent (pre-duration runtime IR).
  const declared = compiled.timeline.duration;
  if (declared !== undefined && declared > 0) return declared;
  const clips = orderedClips(compiled);
  if (clips.length === 0) return 0;
  return clips.reduce(
    (max, { clip }) => Math.max(max, clip.start + clip.duration),
    0,
  );
}

/**
 * Returns all visible scene layers at a global project timestamp, ordered
 * bottom-to-top for compositing.
 *
 * A clip is active when `globalTime >= clip.start && globalTime <
 * clip.start + clip.duration`. Scene local time applies trimStart /
 * playbackRate / loop; transition opacity ramps stay composition-relative.
 * Gaps and manual tail frames simply produce no layer for that clip.
 */
export function projectFrameLayers(
  compiled: CompiledProject,
  globalTime: number,
  fps = 30,
): FrameLayer[] {
  const safeFps = Math.max(1, fps);
  return orderedClips(compiled).flatMap(({ clip }) => {
    const compositionLocalTime = globalTime - clip.start;
    if (compositionLocalTime < 0 || compositionLocalTime >= clip.duration) {
      return [];
    }
    const sceneIndex = resolveSceneIndex(compiled, clip);
    if (sceneIndex < 0) return [];
    let opacity = clip.opacity ?? 1;

    const incoming = transitionOverlap(clip.transitionIn);
    if (incoming > 0 && compositionLocalTime < incoming) {
      opacity *= compositionLocalTime / incoming;
    }
    const outgoing = transitionOverlap(clip.transitionOut);
    if (outgoing > 0 && compositionLocalTime >= clip.duration - outgoing) {
      opacity *= (clip.duration - compositionLocalTime) / outgoing;
    }
    const sourceDuration = resolveSourceDuration(compiled, clip);
    return [
      {
        sceneIndex,
        localTime: clipLocalTime(
          clip,
          compositionLocalTime,
          safeFps,
          sourceDuration,
        ),
        opacity,
      },
    ];
  });
}

/** Deterministic global frame plan — same on main thread and every worker. */
export function buildFramePlan(
  compiled: CompiledProject,
  fps: number,
): FrameJob[] {
  const jobs: FrameJob[] = [];
  const safeFps = Math.max(1, fps);
  const frameCount = Math.max(
    1,
    Math.round(projectDuration(compiled) * safeFps),
  );
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const globalTime = frameTimestamp(frameIndex, safeFps).time;
    const layers = projectFrameLayers(compiled, globalTime, safeFps);
    const primary = layers.at(-1) ?? { sceneIndex: 0, localTime: 0 };
    jobs.push({
      frameIndex,
      sceneIndex: primary.sceneIndex,
      localTime: primary.localTime,
      globalTime,
      layers,
    });
  }
  return jobs;
}

/** Split into N contiguous chunks (frames are independent — any split is safe). */
export function chunkFramePlan(jobs: FrameJob[], chunks: number): FrameJob[][] {
  const size = Math.ceil(jobs.length / chunks);
  const out: FrameJob[][] = [];
  for (let i = 0; i < jobs.length; i += size) {
    out.push(jobs.slice(i, i + size));
  }
  return out;
}
