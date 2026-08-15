import type { TimelineClip, TimelineLane } from "../timeline-clips";
import type {
  MotionProjectV1,
  VisualClipV1,
  VisualTrackV1,
} from "@motionvideo/motion-protocol";

type SceneClip = Extract<TimelineClip, { kind: "scene" }>;

/**
 * Keep every scene referenced by a visual clip in project.scenes, and mirror
 * the current editor lanes/clips back into the project timeline so autosave
 * always produces a schema-valid project.
 *
 * Phase 8: V1 only — writes visualTracks directly.
 */
export function rebuildMainProject(
  project: MotionProjectV1,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionProjectV1 {
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const orderedIds = computeOrderedSceneIds(project, clips, lanes);
  const scenes = orderedIds.map((sceneId) => byId.get(sceneId)!);

  return rebuildV1Timeline(
    project,
    scenes as MotionProjectV1["scenes"],
    orderedIds,
    clips,
    lanes,
  );
}

/** Main-lane scene ids first, then any other referenced scene ids. */
function computeOrderedSceneIds(
  project: MotionProjectV1,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): string[] {
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const mainId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  const main = clips
    .filter(
      (clip): clip is SceneClip =>
        clip.kind === "scene" && clip.laneId === mainId,
    )
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  const orderedMainSceneIds = main
    .map((clip) => clip.sceneId)
    .filter((sceneId) => byId.has(sceneId));

  // Overlay/base đều giữ scene content — không xóa khi đổi lane (MODEL-02).
  const referenced = new Set(
    clips
      .filter((clip): clip is SceneClip => clip.kind === "scene")
      .map((clip) => clip.sceneId)
      .filter((sceneId) => byId.has(sceneId)),
  );
  return [
    ...orderedMainSceneIds,
    ...[...referenced].filter((id) => !orderedMainSceneIds.includes(id)),
  ];
}

function toV1Clip(clip: SceneClip): VisualClipV1 {
  return {
    id: clip.id,
    source: { kind: "scene", sceneId: clip.sceneId },
    start: clip.startTime,
    duration: clip.duration,
    opacity: 1,
    loop: false,
  };
}

/**
 * Mirror base-lane clips into the main track and overlay-lane clips
 * into a single overlay track. Falls back to sequential clips over every
 * referenced scene when the base lane is empty.
 */
function rebuildV1Timeline(
  project: MotionProjectV1,
  scenes: MotionProjectV1["scenes"],
  orderedIds: string[],
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionProjectV1 {
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const mainId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  const mainClips = clips
    .filter(
      (clip): clip is SceneClip =>
        clip.kind === "scene" && clip.laneId === mainId,
    )
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));

  const overlayLaneIds = new Set(
    lanes
      .filter((lane) => lane.kind === "visual" && lane.role === "overlay")
      .map((lane) => lane.id),
  );
  const overlayClips = clips
    .filter(
      (clip): clip is SceneClip =>
        clip.kind === "scene" && overlayLaneIds.has(clip.laneId),
    )
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));

  const existingTracks = project.timeline.visualTracks;
  const usedIds = new Set([
    ...existingTracks.map((track) => track.id),
    ...project.scenes.map((scene) => scene.id),
  ]);

  const tracks: VisualTrackV1[] = [];

  if (mainClips.length > 0) {
    const mainTrack = existingTracks.find((track) => track.role === "main") ?? {
      id: uniqueId(usedIds, "main-track"),
      role: "main" as const,
      order: 0,
      muted: false,
      clips: [] as VisualClipV1[],
    };
    tracks.push({ ...mainTrack, clips: mainClips.map(toV1Clip) });
    if (overlayClips.length > 0) {
      const overlayTrack = existingTracks.find(
        (track) => track.role === "overlay",
      ) ?? {
        id: uniqueId(usedIds, "track.overlay"),
        role: "overlay" as const,
        order: existingTracks.length,
        muted: false,
        clips: [] as VisualClipV1[],
      };
      tracks.push({ ...overlayTrack, clips: overlayClips.map(toV1Clip) });
    }
  } else {
    // Base lane empty: keep every referenced scene in the main track with
    // sequential starts (no overlay track so a scene is not rendered twice).
    const fallback = orderedIds
      .map((sceneId) => byId.get(sceneId))
      .filter((scene): scene is NonNullable<typeof scene> => Boolean(scene));
    if (fallback.length > 0) {
      let cursor = 0;
      const fallbackClips: VisualClipV1[] = fallback.map((scene) => {
        const clip: VisualClipV1 = {
          id: `clip-${scene.id}`,
          source: { kind: "scene", sceneId: scene.id },
          start: cursor,
          duration: scene.duration,
          opacity: 1,
          loop: false,
        };
        cursor += scene.duration;
        return clip;
      });
      const mainTrack = existingTracks.find(
        (track) => track.role === "main",
      ) ?? {
        id: uniqueId(usedIds, "main-track"),
        role: "main" as const,
        order: 0,
        muted: false,
        clips: [] as VisualClipV1[],
      };
      tracks.push({ ...mainTrack, clips: fallbackClips });
    }
  }

  return {
    ...project,
    scenes,
    timeline: {
      ...project.timeline,
      visualTracks: tracks,
    },
  };
}

/** Smallest `base` (or `base.N`) id not present in `usedIds`. */
function uniqueId(usedIds: Set<string>, base: string): string {
  if (!usedIds.has(base)) return base;
  let n = 1;
  while (usedIds.has(`${base}.${n}`)) n += 1;
  return `${base}.${n}`;
}
