import type { TimelineClip, TimelineLane } from "../timeline-clips";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { deriveTimelineDurationV1 } from "@motionvideo/motion-protocol";

type SceneClip = Extract<TimelineClip, { kind: "scene" }>;
type AudioClip = Extract<TimelineClip, { kind: "audio" }>;

type LayerIndexEntry = {
  parentId: string | null;
  offset: number;
};

function indexLayerOffsets(
  layers: readonly MotionLayer[],
  parentId: string | null,
  offset: number,
  into: Map<string, LayerIndexEntry>,
): void {
  for (const layer of layers) {
    into.set(layer.id, { parentId, offset });
    if (layer.type === "group") {
      indexLayerOffsets(layer.children, layer.id, offset + layer.timing.start, into);
    }
  }
}

function visualWriteOrder(lanes: readonly TimelineLane[]): TimelineLane[] {
  const base = lanes.filter((lane) => lane.kind === "visual" && lane.role === "base");
  const overlays = lanes
    .filter((lane) => lane.kind === "visual" && lane.role === "overlay")
    .sort((a, b) => a.order - b.order);
  return [...base, ...overlays];
}

function audioWriteOrder(lanes: readonly TimelineLane[]): TimelineLane[] {
  return lanes
    .filter((lane) => lane.kind === "audio")
    .sort((a, b) => a.order - b.order);
}

function mergeSceneTiming(clips: readonly SceneClip[]): {
  start: number;
  duration: number;
} {
  const start = Math.min(...clips.map((clip) => clip.startTime));
  const end = Math.max(
    ...clips.map((clip) => clip.startTime + clip.duration),
  );
  return { start, duration: Math.max(0, end - start) };
}

function clipsOnLane(
  clips: readonly TimelineClip[],
  laneId: string,
): TimelineClip[] {
  return clips
    .filter((clip) => clip.laneId === laneId)
    .sort(
      (a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id),
    );
}

/**
 * Assign a unique zIndex per clip from lane membership.
 * Visual: base then overlays, left → right → 0..n.
 * Audio: audio lanes in order, left → right → -1, -2, …
 */
export function uniqueZIndexByLayerId(
  clips: readonly TimelineClip[],
  lanes: readonly TimelineLane[],
): Map<string, number> {
  const assigned = new Map<string, number>();
  let visualZ = 0;
  for (const lane of visualWriteOrder(lanes)) {
    for (const clip of clipsOnLane(clips, lane.id)) {
      if (clip.kind !== "scene") continue;
      assigned.set(clip.sceneId, visualZ);
      visualZ += 1;
    }
  }
  let audioZ = -1;
  for (const lane of audioWriteOrder(lanes)) {
    for (const clip of clipsOnLane(clips, lane.id)) {
      if (clip.kind !== "audio") continue;
      assigned.set(clip.audioTrackId ?? clip.id, audioZ);
      audioZ -= 1;
    }
  }
  return assigned;
}

function uniquifySiblingZ(layers: MotionLayer[]): MotionLayer[] {
  const used = new Set<number>();
  return layers.map((layer) => {
    let z = layer.zIndex;
    if (used.has(z)) {
      if (layer.type === "audio") {
        z = -1;
        while (used.has(z)) z -= 1;
      } else {
        z = 0;
        while (used.has(z)) z += 1;
      }
    }
    used.add(z);
    const next = z === layer.zIndex ? layer : { ...layer, zIndex: z };
    if (next.type === "group") {
      return { ...next, children: uniquifySiblingZ(next.children) };
    }
    return next;
  });
}

/**
 * Mirror editor lanes/clips back into `project.layers`.
 *
 * Each clip gets its own unique sibling `zIndex` — never one zIndex for a
 * whole packed lane. Nested `children` keep local timing
 * (`clip.startTime - ancestorOffset`).
 */
export function rebuildMainProject(
  project: MotionProject,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionProject {
  const zByLayer = uniqueZIndexByLayerId(clips, lanes);
  const sceneClipsByLayer = new Map<string, SceneClip[]>();
  const audioByLayer = new Map<string, AudioClip>();
  const clipLayerIds = new Set<string>();
  for (const clip of clips) {
    if (clip.kind === "scene") {
      const list = sceneClipsByLayer.get(clip.sceneId) ?? [];
      list.push(clip);
      sceneClipsByLayer.set(clip.sceneId, list);
      clipLayerIds.add(clip.sceneId);
    } else {
      const id = clip.audioTrackId ?? clip.id;
      audioByLayer.set(id, clip);
      clipLayerIds.add(id);
    }
  }

  const offsets = new Map<string, LayerIndexEntry>();
  indexLayerOffsets(project.layers, null, 0, offsets);

  const parentsWithClips = new Set<string>();
  for (const id of clipLayerIds) {
    const hit = offsets.get(id);
    if (hit?.parentId) parentsWithClips.add(hit.parentId);
  }

  const patchTree = (
    layers: MotionLayer[],
    parentId: string | null,
    ancestorOffset: number,
  ): MotionLayer[] => {
    const scoped =
      parentId && parentsWithClips.has(parentId)
        ? layers.filter((layer) => clipLayerIds.has(layer.id))
        : layers;

    return scoped.map((layer) => {
      const audioClip =
        layer.type === "audio" ? audioByLayer.get(layer.id) : undefined;
      const sceneClips =
        layer.type === "audio" ? undefined : sceneClipsByLayer.get(layer.id);
      const z = zByLayer.get(layer.id);
      let next: MotionLayer = layer;
      if (audioClip) {
        const localStart = Math.max(0, audioClip.startTime - ancestorOffset);
        next = {
          ...layer,
          zIndex: z ?? layer.zIndex,
          timing: { start: localStart, duration: audioClip.duration },
        };
      } else if (sceneClips && sceneClips.length > 0) {
        const merged = mergeSceneTiming(sceneClips);
        const localStart = Math.max(0, merged.start - ancestorOffset);
        next = {
          ...layer,
          zIndex: z ?? layer.zIndex,
          timing: { start: localStart, duration: merged.duration },
        };
      } else if (z != null) {
        next = { ...layer, zIndex: z };
      }
      if (next.type === "group") {
        return {
          ...next,
          children: patchTree(
            next.children,
            next.id,
            ancestorOffset + next.timing.start,
          ),
        };
      }
      return next;
    });
  };

  const layers = uniquifySiblingZ(patchTree(project.layers, null, 0));

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
