import type { MotionProject } from "@motionvideo/motion-protocol";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "../model/timeline-types";

let _laneSeq = 0;

function _uid(prefix: string): string {
  _laneSeq += 1;
  return `${prefix}_${_laneSeq}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Derive timeline lanes + clips from project.timeline.visualTracks
 * and project.timeline.audioTracks (Phase 8: V1 only).
 *
 * Every V1 visual track maps to a visual lane (main → base, overlay → overlay);
 * audio tracks map to audio clips with a shared audio lane.
 */
export function visualTracksToTimelineClips(project: MotionProject): {
  lanes: TimelineLane[];
  clips: TimelineClip[];
} {
  const scenesById = new Map(project.scenes.map((s) => [s.id, s] as const));
  const lanes: TimelineLane[] = [];
  const clips: TimelineClip[] = [];

  // ── Visual tracks → lanes + scene clips ──
  const visualTracks = project.timeline.visualTracks;

  for (const track of visualTracks) {
    const role: "base" | "overlay" =
      track.role === "overlay" ? "overlay" : "base";
    const lane: TimelineLane = {
      id: track.id,
      kind: "visual",
      role,
      order: track.order ?? 0,
      name: role === "base" ? "Main" : track.id,
      policy: { ...DEFAULT_VISUAL_POLICY },
    };
    lanes.push(lane);

    for (const vc of track.clips) {
      const sourceId =
        vc.source.kind === "scene" ? vc.source.sceneId : vc.source.componentId;
      const scene = sourceId ? scenesById.get(sourceId) : undefined;
      clips.push({
        id: vc.id,
        kind: "scene",
        sceneId: sourceId ?? "",
        laneId: track.id,
        startTime: vc.start,
        duration: vc.duration,
        name: scene?.name ?? sourceId ?? vc.id,
      });
    }
  }

  // ── Audio tracks → audio clips (shared lane) ──
  const audioTracks = project.timeline.audioTracks;
  if (audioTracks.length > 0) {
    const audioLaneId = _uid("lane_audio");
    const audioLane: TimelineLane = {
      id: audioLaneId,
      kind: "audio",
      role: "audio",
      order: lanes.length,
      name: "Audio",
    };
    lanes.push(audioLane);

    for (const track of audioTracks) {
      clips.push({
        id: track.id,
        kind: "audio",
        audioTrackId: track.id,
        assetId: track.assetId,
        laneId: audioLaneId,
        startTime: track.start,
        duration: track.duration,
        name: track.id,
      });
    }
  }

  return { lanes, clips };
}
