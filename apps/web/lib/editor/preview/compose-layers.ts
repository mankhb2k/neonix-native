/**
 * Preview compose — xác định lớp visual tại global time (Phase 6).
 * Thứ tự: project background → base → overlay theo lane.order tăng dần (z thấp → cao).
 */

import type { MotionScene } from "@motionvideo/motion-schema";
import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
import { isSceneClip } from "@/lib/editor/timeline-clips";

export type ComposedSceneLayer = {
  clipId: string;
  sceneId: string;
  localTime: number;
  /** Lane order — overlay cao hơn vẽ sau. Base dùng -1. */
  zOrder: number;
  role: "base" | "overlay";
};

/** Clip chứa `time` (nửa khoảng [start, start+duration)). */
export function clipContainsTime(clip: TimelineClip, time: number): boolean {
  return time >= clip.startTime && time < clip.startTime + clip.duration;
}

/** Binary search clip active tại time trên danh sách đã sort theo startTime. */
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
  // Gap trên lane: không lấy clip trước đó nếu time nằm ngoài duration.
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

/**
 * Compose visual layers tại `time`.
 * Lane `visible === false` bị bỏ qua. Base gap → chỉ còn background + overlay (nếu có).
 */
export function composeVisualLayersAtTime(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  time: number,
): ComposedSceneLayer[] {
  const layers: ComposedSceneLayer[] = [];
  const baseLane = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  );
  if (baseLane?.kind === "visual" && baseLane.visible !== false) {
    const clip = findActiveClipAtTime(
      sortedSceneClipsOnLane(clips, baseLane.id),
      time,
    );
    if (clip && isSceneClip(clip) && clip.sceneId) {
      layers.push({
        clipId: clip.id,
        sceneId: clip.sceneId,
        localTime: Math.min(
          Math.max(0, time - clip.startTime),
          Math.max(0, clip.duration - 1e-6),
        ),
        zOrder: -1,
        role: "base",
      });
    }
  }

  const overlayLanes = lanes
    .filter(
      (lane) =>
        lane.kind === "visual" &&
        lane.role === "overlay" &&
        lane.visible !== false,
    )
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  for (const lane of overlayLanes) {
    const clip = findActiveClipAtTime(
      sortedSceneClipsOnLane(clips, lane.id),
      time,
    );
    if (!clip || !isSceneClip(clip) || !clip.sceneId) continue;
    layers.push({
      clipId: clip.id,
      sceneId: clip.sceneId,
      localTime: Math.min(
        Math.max(0, time - clip.startTime),
        Math.max(0, clip.duration - 1e-6),
      ),
      zOrder: lane.order,
      role: "overlay",
    });
  }

  return layers;
}

export function resolveScene(
  scenesById: Map<string, MotionScene>,
  scenes: MotionScene[],
  sceneId: string,
): MotionScene | undefined {
  return scenesById.get(sceneId) ?? scenes.find((s) => s.id === sceneId);
}
