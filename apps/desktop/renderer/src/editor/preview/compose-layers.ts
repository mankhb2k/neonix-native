/**
 * Preview compose — visual layers at global time.
 */

import type { MotionScene } from "@motionvideo/motion-schema";
import {
  isSceneClip,
  type TimelineClip,
  type TimelineLane,
  type VisualTimelineLane,
} from "@motionvideo/editor-core";

export type ComposedSceneLayer = {
  clipId: string;
  sceneId: string;
  localTime: number;
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

export function clipContainsTime(clip: TimelineClip, time: number): boolean {
  return time >= clip.startTime && time < clip.startTime + clip.duration;
}

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
    baseVisible: baseLane?.kind === "visual" ? baseLane.visible !== false : false,
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

export function composeAtTime(
  index: VisualLaneIndex,
  time: number,
): ComposedSceneLayer[] {
  const layers: ComposedSceneLayer[] = [];
  if (index.baseVisible && index.baseLaneId) {
    const clip = findActiveClipAtTime(index.baseClips, time);
    if (clip && isSceneClip(clip) && clip.sceneId) {
      layers.push({
        clipId: clip.id,
        sceneId: clip.sceneId,
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
      sceneId: clip.sceneId,
      localTime: localTimeOf(clip, time),
      zOrder: lane.order,
      role: "overlay",
    });
  }

  return layers;
}

export function composeVisualLayersAtTime(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  time: number,
): ComposedSceneLayer[] {
  return composeAtTime(buildVisualLaneIndex(clips, lanes), time);
}

export function resolveScene(
  scenesById: Map<string, MotionScene>,
  scenes: MotionScene[],
  sceneId: string,
): MotionScene | undefined {
  return scenesById.get(sceneId) ?? scenes.find((s) => s.id === sceneId);
}
