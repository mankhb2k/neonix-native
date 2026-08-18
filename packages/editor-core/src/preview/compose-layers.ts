/**
 * Preview compose — xác định root visual layer tại global time (Phase 6).
 * Index memo theo clips/lanes; frame chỉ binary search (PERF).
 */

import type { MotionLayer } from "@motionvideo/motion-protocol";
import {
  isSceneClip,
  type TimelineClip,
  type TimelineLane,
  type VisualTimelineLane,
} from "../timeline/model/timeline-types";

/**
 * Một root visual layer được compose tại `time`.
 * `layerId` = id của root layer trong protocol (nguồn của `TimelineClip.sceneId`).
 */
export type ComposedLayer = {
  clipId: string;
  layerId: string;
  localTime: number;
  /** Lane order — overlay cao hơn vẽ sau. Base dùng -1. */
  zOrder: number;
  role: "base" | "overlay";
};

export type VisualLaneIndex = {
  baseLaneId: string | null;
  baseVisible: boolean;
  baseClips: TimelineClip[];
  overlayLanes: Array<{
    lane: VisualTimelineLane;
    clips: TimelineClip[];
  }>;
};

/** Clip chứa `time` (nửa khoảng [start, start+duration)). */
export function clipContainsTime(clip: TimelineClip, time: number): boolean {
  return time >= clip.startTime && time < clip.startTime + clip.duration;
}

/**
 * Binary search clip active tại `time` trên danh sách đã sort theo startTime.
 *
 * Overlap policy (explicit): lane/clip giả định không overlap trong cùng lane
 * (`VisualLanePolicy.allowOverlap === false`). Nếu dữ liệu hỏng vẫn có overlap
 * bất hợp lệ, clip có `startTime` lớn nhất `<= time` thắng ("later start wins");
 * tie-break theo `id` (localeCompare) ở `sortedSceneClipsOnLane`.
 */
export function findActiveClipAtTime(
  sortedClips: TimelineClip[],
  time: number,
): TimelineClip | undefined {
  let lo = 0;
  let hi = sortedClips.length - 1;
  let candidate: TimelineClip | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const clip = sortedClips[mid];
    if (time < clip.startTime) {
      hi = mid - 1;
    } else {
      candidate = clip;
      lo = mid + 1;
    }
  }
  if (!candidate) return undefined;
  if (!clipContainsTime(candidate, time)) return undefined;
  return candidate;
}

function sortedSceneClipsOnLane(
  clips: TimelineClip[],
  laneId: string,
): TimelineClip[] {
  return clips
    .filter((clip) => clip.laneId === laneId && isSceneClip(clip))
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
}

/** Build index một lần khi clips/lanes đổi — frame chỉ composeAtTime. */
export function buildVisualLaneIndex(
  clips: TimelineClip[],
  lanes: TimelineLane[],
): VisualLaneIndex {
  const baseLane = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  );
  const overlayLanes = lanes
    .filter(
      (lane): lane is VisualTimelineLane =>
        lane.kind === "visual" &&
        lane.role === "overlay" &&
        lane.visible !== false,
    )
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((lane) => ({
      lane,
      clips: sortedSceneClipsOnLane(clips, lane.id),
    }));

  return {
    baseLaneId: baseLane?.id ?? null,
    baseVisible:
      baseLane?.kind === "visual" ? baseLane.visible !== false : false,
    baseClips: baseLane ? sortedSceneClipsOnLane(clips, baseLane.id) : [],
    overlayLanes,
  };
}

function localTimeOf(clip: TimelineClip, time: number): number {
  return Math.min(
    Math.max(0, time - clip.startTime),
    Math.max(0, clip.duration - 1e-6),
  );
}

/** Compose từ index đã memo — O(log n) per lane. */
export function composeAtTime(
  index: VisualLaneIndex,
  time: number,
): ComposedLayer[] {
  const layers: ComposedLayer[] = [];
  if (index.baseVisible && index.baseLaneId) {
    const clip = findActiveClipAtTime(index.baseClips, time);
    if (clip && isSceneClip(clip) && clip.sceneId) {
      layers.push({
        clipId: clip.id,
        layerId: clip.sceneId,
        localTime: localTimeOf(clip, time),
        zOrder: -1,
        role: "base",
      });
    }
  }

  for (const { lane, clips } of index.overlayLanes) {
    const clip = findActiveClipAtTime(clips, time);
    if (!clip || !isSceneClip(clip) || !clip.sceneId) continue;
    layers.push({
      clipId: clip.id,
      layerId: clip.sceneId,
      localTime: localTimeOf(clip, time),
      zOrder: lane.order,
      role: "overlay",
    });
  }

  return layers;
}

/**
 * Compose visual layers tại `time`.
 * Lane `visible === false` bị bỏ qua. Base gap → chỉ còn background + overlay (nếu có).
 */
export function composeVisualLayersAtTime(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  time: number,
): ComposedLayer[] {
  return composeAtTime(buildVisualLaneIndex(clips, lanes), time);
}

/** Resolve root layer theo `layerId` (map trước, rồi fallback linear scan). */
export function resolveLayer(
  layersById: Map<string, MotionLayer>,
  layers: MotionLayer[],
  layerId: string,
): MotionLayer | undefined {
  return layersById.get(layerId) ?? layers.find((l) => l.id === layerId);
}
