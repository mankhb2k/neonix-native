import type { CompiledProject } from "../compiler";
import { frameTimestamp } from "@motionvideo/motion-runtime";

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

// ── Visual clip helpers (Phase 6: V3 visualTracks model) ──────────────

type VisualClipLike = {
  start: number;
  duration: number;
  source: { kind: string; sceneId?: string; componentId?: string };
  transitionOut?: { type: string; duration?: number } | null;
};

function overlapFromTransition(
  transition: VisualClipLike["transitionOut"],
): number {
  if (!transition) return 0;
  return transition.type === "fade" || transition.type === "crossfade"
    ? (transition.duration ?? 0)
    : 0;
}

/**
 * Extract ordered clips from the primary visual track.
 * Falls back to building clips from sceneOrder when visualTracks is absent
 * (legacy runtime IR during format cutover).
 */
function primaryClips(compiled: CompiledProject): VisualClipLike[] {
  const track = compiled.timeline.visualTracks?.find(
    (t) => t.role === "primary",
  );
  if (track && track.clips.length > 0) {
    return [...track.clips].sort((a, b) => a.start - b.start);
  }

  // Legacy fallback: build clips from sceneOrder + scene.transition
  const order =
    compiled.timeline.sceneOrder.length > 0
      ? compiled.timeline.sceneOrder
      : compiled.scenes.map((s) => s.id);
  const byId = new Map(compiled.scenes.map((s) => [s.id, s]));
  const clips: VisualClipLike[] = [];
  let cursor = 0;
  for (const id of order) {
    const scene = byId.get(id);
    if (!scene) continue;
    clips.push({
      start: cursor,
      duration: scene.duration,
      source: { kind: "scene", sceneId: id },
      transitionOut: scene.transition as VisualClipLike["transitionOut"],
    });
    cursor += scene.duration;
  }
  return clips;
}

function resolveSceneIndex(
  compiled: CompiledProject,
  clip: VisualClipLike,
): number {
  const sourceId =
    clip.source.kind === "scene"
      ? clip.source.sceneId
      : clip.source.componentId;
  return sourceId ? compiled.scenes.findIndex((s) => s.id === sourceId) : -1;
}

// ── Public API (unchanged signatures) ─────────────────────────────────

export function sceneStartTimes(compiled: CompiledProject): number[] {
  const clips = primaryClips(compiled);
  const starts: number[] = [];
  let cursor = 0;
  for (const clip of clips) {
    starts.push(cursor);
    cursor += clip.duration - overlapFromTransition(clip.transitionOut);
  }
  return starts;
}

export function projectDuration(compiled: CompiledProject): number {
  const clips = primaryClips(compiled);
  if (clips.length === 0) return 0;
  const starts = sceneStartTimes(compiled);
  const last = clips[clips.length - 1]!;
  return starts[starts.length - 1]! + last.duration;
}

/** Returns ordered scene layers at a global project timestamp. */
export function projectFrameLayers(
  compiled: CompiledProject,
  globalTime: number,
): FrameLayer[] {
  const clips = primaryClips(compiled);
  const starts = sceneStartTimes(compiled);
  return clips.flatMap((clip, clipIndex) => {
    const localTime = globalTime - starts[clipIndex]!;
    if (localTime < 0 || localTime >= clip.duration) return [];
    const sceneIndex = resolveSceneIndex(compiled, clip);
    if (sceneIndex < 0) return [];
    let opacity = 1;
    const outgoing = overlapFromTransition(clip.transitionOut);
    if (outgoing > 0 && localTime >= clip.duration - outgoing) {
      opacity *= (clip.duration - localTime) / outgoing;
    }
    const prevClip = clips[clipIndex - 1];
    const incoming = prevClip
      ? overlapFromTransition(prevClip.transitionOut)
      : 0;
    if (incoming > 0 && localTime < incoming) opacity *= localTime / incoming;
    return [{ sceneIndex, localTime, opacity }];
  });
}

/** Deterministic global frame plan — same on main thread and every worker. */
export function buildFramePlan(
  compiled: CompiledProject,
  fps: number,
): FrameJob[] {
  const jobs: FrameJob[] = [];
  const frameCount = Math.max(1, Math.round(projectDuration(compiled) * fps));
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const globalTime = frameTimestamp(frameIndex, fps).time;
    const layers = projectFrameLayers(compiled, globalTime);
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
