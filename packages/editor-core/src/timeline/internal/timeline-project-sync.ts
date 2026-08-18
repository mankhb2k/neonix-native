import type { TimelineClip, TimelineLane } from "../timeline-clips";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { deriveTimelineDurationV1 } from "@motionvideo/motion-protocol";

type SceneClip = Extract<TimelineClip, { kind: "scene" }>;
type AudioClip = Extract<TimelineClip, { kind: "audio" }>;

/** Map a lane id to the root-layer zIndex it represents (base=0, overlay>0, audio<0). */
function zIndexForLane(lane: TimelineLane): number {
  if (lane.kind === "audio") return -1;
  return lane.role === "base" ? 0 : Math.max(1, lane.order + 1);
}

/**
 * Mirror the editor lanes/clips back into `project.layers`.
 *
 * V1 keeps timeline placement on each root layer (`timing` + `zIndex`):
 * - root visual group → scene clip (`zIndex` = lane position).
 * - root audio layer → audio clip (`zIndex` < 0).
 * Nested layer content is preserved verbatim; `timeline.duration` is derived.
 */
export function rebuildMainProject(
  project: MotionProject,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionProject {
  const laneZ = new Map(lanes.map((lane) => [lane.id, zIndexForLane(lane)]));
  const sceneByLayer = new Map<string, SceneClip>();
  const audioByLayer = new Map<string, AudioClip>();
  for (const clip of clips) {
    if (clip.kind === "scene") sceneByLayer.set(clip.sceneId, clip);
    else audioByLayer.set(clip.audioTrackId ?? clip.id, clip);
  }

  const layers: MotionLayer[] = project.layers.map((layer) => {
    if (layer.parentLayerId !== null) return layer;
    if (layer.type === "audio") {
      const clip = audioByLayer.get(layer.id);
      if (!clip) return layer;
      return {
        ...layer,
        zIndex: laneZ.get(clip.laneId) ?? -1,
        timing: { start: clip.startTime, duration: clip.duration },
      };
    }
    const clip = sceneByLayer.get(layer.id);
    if (!clip) return layer;
    return {
      ...layer,
      zIndex: laneZ.get(clip.laneId) ?? 0,
      timing: { start: clip.startTime, duration: clip.duration },
    };
  });

  return {
    ...project,
    layers,
    timeline: {
      ...project.timeline,
      duration: deriveTimelineDurationV1(layers),
    },
  };
}

/** Build a root audio layer from editor audio-clip placement data. */
export function buildAudioLayer(input: {
  id: string;
  assetId: string;
  name?: string;
  start: number;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
  playbackRate?: number;
  volume?: number;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  muted?: boolean;
}): MotionLayer {
  return {
    id: input.id,
    type: "audio",
    ...(input.name ? { name: input.name } : {}),
    parentLayerId: null,
    zIndex: -1,
    timing: { start: input.start, duration: input.duration },
    payload: {
      assetId: input.assetId,
      trimStart: input.trimStart ?? 0,
      ...(input.trimEnd !== undefined ? { trimEnd: input.trimEnd } : {}),
      playbackRate: input.playbackRate ?? 1,
      volume: input.volume ?? 100,
      loop: input.loop ?? false,
      fadeIn: input.fadeIn ?? 0,
      fadeOut: input.fadeOut ?? 0,
      muted: input.muted ?? false,
    },
  };
}
