import type { TimelineClip, TimelineLane } from "../timeline-clips";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { sanitizeEditorProject } from "../../document/sanitize-editor-project";

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
      indexLayerOffsets(
        layer.children,
        layer.id,
        offset + layer.timing.start,
        into,
      );
    }
  }
}

function visualWriteOrder(lanes: readonly TimelineLane[]): TimelineLane[] {
  const base = lanes.filter(
    (lane) => lane.kind === "visual" && lane.role === "base",
  );
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
  const end = Math.max(...clips.map((clip) => clip.startTime + clip.duration));
  return { start, duration: Math.max(0, end - start) };
}

function clipsOnLane(
  clips: readonly TimelineClip[],
  laneId: string,
  timeOrder: "asc" | "desc" = "asc",
): TimelineClip[] {
  const dir = timeOrder === "desc" ? -1 : 1;
  return clips
    .filter((clip) => clip.laneId === laneId)
    .sort(
      (a, b) =>
        dir * (a.startTime - b.startTime) || dir * a.id.localeCompare(b.id),
    );
}

/**
 * Gán zIndex duy nhất cho mỗi clip theo lane membership.
 * Thứ tự Visual Canva: Main rồi overlay; trong lane phải → trái (startTime sau
 * trước) để số tăng về bên trái rồi lên trên. Không reset theo lane — một dãy
 * liên tục 0..n. Audio: trái → phải → -1, -2, …
 */
export function uniqueZIndexByLayerId(
  clips: readonly TimelineClip[],
  lanes: readonly TimelineLane[],
): Map<string, number> {
  const assigned = new Map<string, number>();
  let visualZ = 0;
  for (const lane of visualWriteOrder(lanes)) {
    for (const clip of clipsOnLane(clips, lane.id, "desc")) {
      if (clip.kind !== "scene") continue;
      assigned.set(clip.sceneId, visualZ);
      visualZ += 1;
    }
  }
  let audioZ = -1;
  for (const lane of audioWriteOrder(lanes)) {
    for (const clip of clipsOnLane(clips, lane.id, "asc")) {
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
 * Kẹp child timing không vượt quá parent duration (protocol: end(child) <= end(parent)).
 * Đệ quy vào group con; giữ nguyên khi child đã nằm trong khoảng parent.
 */
function clampChildToParent(
  layer: MotionLayer,
  parentDuration: number,
): MotionLayer {
  const start = Math.min(layer.timing.start, parentDuration);
  const duration = Math.min(
    layer.timing.duration,
    Math.max(0, parentDuration - start),
  );
  const next =
    start === layer.timing.start && duration === layer.timing.duration
      ? layer
      : { ...layer, timing: { start, duration } };
  if (next.type === "group") {
    return {
      ...next,
      children: next.children.map((child) =>
        clampChildToParent(child, duration),
      ),
    };
  }
  return next;
}

/**
 * Ghi ngược editor lanes/clips về `project.layers`.
 * Mỗi clip nhận `zIndex` duy nhất giữa anh em — không bao giờ một zIndex cho cả
 * lane đã pack. `children` lồng nhau giữ local timing (`clip.startTime - ancestorOffset`).
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
        const children = patchTree(
          next.children,
          next.id,
          ancestorOffset + next.timing.start,
        );
        return {
          ...next,
          children: children.map((child) =>
            clampChildToParent(child, next.timing.duration),
          ),
        };
      }
      return next;
    });
  };

  const layers = uniquifySiblingZ(patchTree(project.layers, null, 0));

  return sanitizeEditorProject({
    ...project,
    layers,
  });
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
