import type { MotionProject } from "@motionvideo/motion-schema";
import type { OverlaySceneItem } from "@/lib/overlay-scenes";

export type TimelineTrackKind = "main" | "overlay";

export type TimelineClip = {
  id: string;
  sceneId: string;
  track: TimelineTrackKind;
  layerIndex?: number;
  startTime: number;
  duration: number;
  name: string;
};

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseTimelineClips(input: unknown): TimelineClip[] {
  if (!Array.isArray(input)) return [];
  const clips: TimelineClip[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.sceneId !== "string" ||
      (row.track !== "main" && row.track !== "overlay") ||
      typeof row.name !== "string" ||
      !validNumber(row.startTime) ||
      !validNumber(row.duration)
    ) continue;
    if (row.layerIndex !== undefined && (!validNumber(row.layerIndex) || row.layerIndex < 0)) continue;
    clips.push({
      id: row.id,
      sceneId: row.sceneId,
      track: row.track,
      ...(row.layerIndex === undefined ? {} : { layerIndex: Math.floor(row.layerIndex) }),
      startTime: Math.max(0, row.startTime),
      duration: Math.max(0, row.duration),
      name: row.name,
    });
  }
  return clips;
}

/** Converts the original scene sequence and overlay sidecar into unified clips. */
export function migrateClipsFromLegacy(
  project: MotionProject,
  overlays: OverlaySceneItem[],
): TimelineClip[] {
  const scenesById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  let startTime = 0;
  const main = project.timeline.sceneOrder.flatMap((sceneId) => {
    const scene = scenesById.get(sceneId);
    if (!scene) return [];
    const clip: TimelineClip = {
      id: scene.id,
      sceneId: scene.id,
      track: "main",
      startTime,
      duration: scene.duration,
      name: scene.name ?? scene.semantic?.role ?? scene.id,
    };
    startTime += scene.duration;
    return [clip];
  });
  const overlay = overlays.map((item): TimelineClip => ({
    id: item.id,
    sceneId: item.id,
    track: "overlay",
    layerIndex: item.layerIndex,
    startTime: item.startTime,
    duration: item.duration,
    name: item.name,
  }));
  return [...main, ...overlay];
}

export function clipsContentEndSeconds(clips: TimelineClip[]): number {
  return clips.reduce(
    (end, clip) => Math.max(end, Math.max(0, clip.startTime) + Math.max(0, clip.duration)),
    0,
  );
}

export function rangesOverlap(
  aStart: number,
  aDur: number,
  bStart: number,
  bDur: number,
): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

export function findFreeOverlayLayer(
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLayer: number,
  insertNewLayer: boolean,
): { layerIndex: number; insertNewLayer: boolean } {
  const requested = Math.max(0, Math.floor(preferredLayer));
  if (insertNewLayer) return { layerIndex: requested, insertNewLayer: true };

  const overlays = clips.filter((clip) => clip.track === "overlay");
  const isFree = (layerIndex: number) => !overlays.some((clip) =>
    (clip.layerIndex ?? 0) === layerIndex &&
    rangesOverlap(startTime, duration, clip.startTime, clip.duration));

  if (isFree(requested)) return { layerIndex: requested, insertNewLayer: false };
  const maxLayer = overlays.reduce((max, clip) => Math.max(max, clip.layerIndex ?? 0), -1);
  for (let layer = 0; layer <= maxLayer; layer++) {
    if (isFree(layer)) return { layerIndex: layer, insertNewLayer: false };
  }
  return { layerIndex: maxLayer + 1, insertNewLayer: false };
}

/** Place on main without time-overlap (option A: one lane, no stacked ranges). */
export function resolveMainStartTime(
  clips: TimelineClip[],
  startTime: number,
  duration: number,
): number {
  const main = clips
    .filter((clip) => clip.track === "main")
    .sort((a, b) => a.startTime - b.startTime);
  let t = Math.max(0, startTime);
  for (const clip of main) {
    if (!rangesOverlap(t, duration, clip.startTime, clip.duration)) continue;
    t = clip.startTime + clip.duration;
  }
  return t;
}
