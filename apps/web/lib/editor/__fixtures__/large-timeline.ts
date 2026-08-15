/**
 * Large timeline fixtures for virtualization / DOM-count gates.
 */

import type { MotionProject } from "@motionvideo/motion-protocol";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";

export const PERFORMANCE_BASELINE_CLIP_COUNTS = [20, 100, 500, 2000] as const;

export type LargeTimelineFixture = {
  project: MotionProject;
  lanes: TimelineLane[];
  clips: TimelineClip[];
};

/** Generate N sequential scene clips on the base lane (1s each). */
export function createDenseTimelineFixture(
  clipCount: number,
): LargeTimelineFixture {
  const baseLaneId = "lane_base";
  const overlayLaneId = "lane_ov0";
  const audioLaneId = "lane_au0";

  const lanes: TimelineLane[] = [
    {
      kind: "visual",
      id: baseLaneId,
      role: "base",
      order: -1,
      name: "Main",
      policy: DEFAULT_VISUAL_POLICY,
    },
    {
      kind: "visual",
      id: overlayLaneId,
      role: "overlay",
      order: 0,
      name: "Overlay 1",
      policy: DEFAULT_VISUAL_POLICY,
    },
    {
      kind: "audio",
      id: audioLaneId,
      role: "audio",
      order: 0,
      name: "Audio 1",
    },
  ];

  const clips: TimelineClip[] = [];
  const mainCount = Math.max(1, Math.floor(clipCount * 0.7));
  const overlayCount = Math.max(0, Math.floor(clipCount * 0.2));
  const audioCount = Math.max(0, clipCount - mainCount - overlayCount);

  for (let i = 0; i < mainCount; i++) {
    const id = `clip_main_${i}`;
    clips.push({
      kind: "scene",
      id,
      laneId: baseLaneId,
      startTime: i,
      duration: 1,
      name: `Main ${i}`,
      sceneId: `scene_${i}`,
    });
  }
  for (let i = 0; i < overlayCount; i++) {
    const id = `clip_ov_${i}`;
    clips.push({
      kind: "scene",
      id,
      laneId: overlayLaneId,
      startTime: i * 2,
      duration: 1.5,
      name: `Overlay ${i}`,
      sceneId: `scene_ov_${i}`,
    });
  }
  for (let i = 0; i < audioCount; i++) {
    const id = `clip_au_${i}`;
    clips.push({
      kind: "audio",
      id,
      laneId: audioLaneId,
      startTime: i * 1.5,
      duration: 2,
      name: `Audio ${i}`,
      audioTrackId: `track_${i}`,
      assetId: `asset_${i}`,
    });
  }

  const project = {
    metadata: {
      id: `perf_${clipCount}`,
      title: `Perf ${clipCount}`,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    scenes: clips
      .filter((c) => c.kind === "scene")
      .map((c) => ({
        id: (c as { sceneId: string }).sceneId,
        name: c.name,
        duration: c.duration,
        layers: [],
      })),
    audioTracks: [],
  } as unknown as MotionProject;

  return { project, lanes, clips };
}

/**
 * Expected max mounted clip DOM layers for a viewport of `viewWidth` at `pps`
 * with overscan 120px (plus optional pin budget).
 */
export function expectedVisibleClipBudget(
  clipCount: number,
  viewWidth: number,
  pps: number,
  overscanPx = 120,
  pinBudget = 8,
): number {
  const windowSeconds = (viewWidth + overscanPx * 2) / Math.max(pps, 0.001);
  // Dense fixture packs ~1 clip/sec on main plus overlay/audio overlap.
  const approxVisible = Math.ceil(windowSeconds * 2.5) + pinBudget;
  return Math.min(clipCount, Math.max(approxVisible, pinBudget + 4));
}
