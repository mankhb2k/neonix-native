import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "../model/timeline-types";

/**
 * Derive timeline lanes + clips from `project.layers` root layers.
 *
 * Mapping (clip = 1 root layer; lane = root layer grouped by zIndex sign):
 * - root visual layer (`type !== "audio"`, `parentLayerId === null`) → visual clip.
 *   `zIndex === 0` → base lane; `zIndex > 0` → overlay lane (order = zIndex - 1).
 * - root audio layer (`type === "audio"`, `zIndex < 0`) → audio clip on a shared audio lane.
 */
export function visualTracksToTimelineClips(project: MotionProject): {
  lanes: TimelineLane[];
  clips: TimelineClip[];
} {
  const rootLayers = project.layers.filter(
    (layer) => layer.parentLayerId === null,
  );
  const lanes: TimelineLane[] = [];
  const clips: TimelineClip[] = [];

  const visualLayers = rootLayers.filter(
    (layer): layer is MotionLayer => layer.type !== "audio",
  );
  const audioLayers = rootLayers.filter((layer) => layer.type === "audio");

  // ── Visual root layers → lanes + clips ──
  const overlayZ = new Set<number>();
  for (const layer of visualLayers) {
    if (layer.zIndex > 0) overlayZ.add(layer.zIndex);
    clips.push({
      id: layer.id,
      kind: "scene",
      sceneId: layer.id,
      laneId: layer.zIndex === 0 ? "lane.main" : `lane.overlay.${layer.zIndex}`,
      startTime: layer.timing.start,
      duration: layer.timing.duration,
      name: layer.name ?? layer.id,
    });
  }

  lanes.push({
    id: "lane.main",
    kind: "visual",
    role: "base",
    order: -1,
    name: "Main",
    policy: { ...DEFAULT_VISUAL_POLICY },
  });

  const sortedZ = [...overlayZ].sort((a, b) => a - b);
  sortedZ.forEach((z, idx) => {
    lanes.push({
      id: `lane.overlay.${z}`,
      kind: "visual",
      role: "overlay",
      order: idx,
      name: `Overlay ${idx + 1}`,
      policy: { ...DEFAULT_VISUAL_POLICY },
    });
  });

  // ── Audio root layers → audio clips (shared lane) ──
  if (audioLayers.length > 0) {
    const audioLaneId = "lane.audio";
    lanes.push({
      id: audioLaneId,
      kind: "audio",
      role: "audio",
      order: lanes.length,
      name: "Audio",
    });

    for (const layer of audioLayers) {
      clips.push({
        id: layer.id,
        kind: "audio",
        audioTrackId: layer.id,
        assetId: layer.payload.assetId,
        laneId: audioLaneId,
        startTime: layer.timing.start,
        duration: layer.timing.duration,
        name: layer.name ?? layer.id,
      });
    }
  }

  return { lanes, clips };
}
