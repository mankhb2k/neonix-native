import {
  DEFAULT_VISUAL_POLICY,
  type SceneTimelineClip,
  type TimelineClip,
  type TimelineLane,
  type TimelineTrackKind,
} from "../model/timeline-types";
import type { OverlaySceneItem } from "../../overlay-scenes";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import { packRootLayersToTimeline } from "../selectors/scene-order-clips";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ensureBaseLane(lanes: TimelineLane[]): TimelineLane {
  const existing = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  );
  if (existing) return existing;
  return {
    id: uid("lane"),
    kind: "visual",
    role: "base",
    name: "Main",
    order: -1,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

/** Normalize raw stored clips that may still carry legacy fields into TimelineClip. */
type LegacyClipInput = {
  id: string;
  sceneId?: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
  track?: TimelineTrackKind;
  layerIndex?: number;
  kind?: "scene" | "audio";
  audioTrackId?: string;
  assetId?: string;
};

function toSceneClip(clip: LegacyClipInput, laneId: string): SceneTimelineClip {
  return {
    id: clip.id,
    kind: "scene",
    sceneId: clip.sceneId ?? clip.id,
    laneId,
    startTime: clip.startTime,
    duration: clip.duration,
    name: clip.name,
  };
}

/** Build lanes + clips with laneId from legacy project / overlays / old clips. */
export function migrateLanesAndClips(
  project: MotionProject,
  overlays: OverlaySceneItem[],
  storedClips: TimelineClip[] = [],
  storedLanes: TimelineLane[] = [],
): { lanes: TimelineLane[]; clips: TimelineClip[] } {
  if (storedClips.length === 0 && overlays.length === 0) {
    return packRootLayersToTimeline(project);
  }

  if (
    storedLanes.length > 0 &&
    storedClips.every((clip) => Boolean(clip.laneId))
  ) {
    const lanes = [...storedLanes];
    if (!lanes.some((lane) => lane.kind === "visual" && lane.role === "base")) {
      lanes.push(ensureBaseLane(lanes));
    }
    if (
      storedClips.length > 0 ||
      storedLanes.some((l) => l.kind === "visual" && l.role === "base")
    ) {
      return { lanes, clips: storedClips };
    }
  }

  // Legacy path: giữ track/layerIndex để dựng overlay lanes.
  const rawLegacy: LegacyClipInput[] =
    storedClips.length > 0
      ? storedClips.map((c) => ({
          id: c.id,
          sceneId: c.kind === "scene" ? c.sceneId : c.id,
          laneId: c.laneId,
          startTime: c.startTime,
          duration: c.duration,
          name: c.name,
          kind: c.kind,
          ...(c.kind === "audio"
            ? {
                audioTrackId: c.audioTrackId,
                assetId: c.assetId,
                track: "audio" as const,
              }
            : {}),
        }))
      : migrateLegacyClipInputs(project, overlays);

  const mainLane = ensureBaseLane(
    storedLanes.filter((l) => l.kind === "visual" && l.role === "base"),
  );
  const layerToLane = new Map<number, TimelineLane>();
  const overlayLanes: TimelineLane[] = [];

  for (const clip of rawLegacy) {
    if (
      clip.track === "overlay" ||
      (clip.laneId === "" && clip.layerIndex != null)
    ) {
      const idx = clip.layerIndex ?? 0;
      if (!layerToLane.has(idx)) {
        const lane: TimelineLane = {
          id: uid("lane"),
          kind: "visual",
          role: "overlay",
          name: `Lớp ${idx + 1}`,
          order: idx,
          policy: { ...DEFAULT_VISUAL_POLICY },
        };
        layerToLane.set(idx, lane);
        overlayLanes.push(lane);
      }
    }
  }

  const existingOverlay = storedLanes.filter(
    (l) => l.kind === "visual" && l.role === "overlay",
  );
  const existingAudio = storedLanes.filter((l) => l.kind === "audio");
  const lanes =
    existingOverlay.length > 0 && layerToLane.size === 0
      ? [mainLane, ...existingOverlay, ...existingAudio]
      : [
          mainLane,
          ...overlayLanes.sort((a, b) => a.order - b.order),
          ...existingAudio,
        ];

  const clips: TimelineClip[] = rawLegacy.map((clip) => {
    if (clip.kind === "audio" || clip.track === "audio") {
      const audio: TimelineClip = {
        id: clip.id,
        kind: "audio",
        audioTrackId: clip.audioTrackId ?? clip.sceneId ?? clip.id,
        assetId: clip.assetId ?? clip.name,
        laneId: clip.laneId || "",
        startTime: clip.startTime,
        duration: clip.duration,
        name: clip.name,
      };
      return audio;
    }
    if (clip.laneId) return toSceneClip(clip, clip.laneId);
    if (clip.track === "overlay") {
      const idx = clip.layerIndex ?? 0;
      const lane = layerToLane.get(idx) ?? overlayLanes[0] ?? mainLane;
      return toSceneClip(clip, lane.id);
    }
    return toSceneClip(clip, mainLane.id);
  });

  return { lanes, clips };
}

/** Legacy → clip inputs kèm track/layerIndex (chưa gán laneId). */
function migrateLegacyClipInputs(
  project: MotionProject,
  overlays: OverlaySceneItem[],
): LegacyClipInput[] {
  const visualRoots = project.layers.filter(
    (layer) => layer.type !== "audio" && layer.parentLayerId === null,
  );
  const audioRoots = project.layers.filter(
    (layer): layer is Extract<MotionLayer, { type: "audio" }> =>
      layer.type === "audio",
  );

  const sceneName = (layer: MotionLayer): string => layer.name ?? layer.id;

  const main: LegacyClipInput[] = visualRoots
    .filter((layer) => (layer.zIndex ?? 0) <= 0)
    .map((layer) => ({
      id: layer.id,
      kind: "scene" as const,
      sceneId: layer.id,
      laneId: "",
      startTime: layer.timing.start,
      duration: layer.timing.duration,
      name: sceneName(layer),
      track: "main" as const,
    }));

  const overlayClips: LegacyClipInput[] = [
    ...visualRoots
      .filter((layer) => (layer.zIndex ?? 0) > 0)
      .map((layer) => ({
        id: layer.id,
        kind: "scene" as const,
        sceneId: layer.id,
        laneId: "",
        startTime: layer.timing.start,
        duration: layer.timing.duration,
        name: sceneName(layer),
        track: "overlay" as const,
        layerIndex: layer.zIndex ?? 0,
      })),
    // Legacy overlay sidecar: overlays from separate layerIndex data
    ...overlays.map(
      (item): LegacyClipInput => ({
        id: item.id,
        kind: "scene" as const,
        sceneId: item.id,
        laneId: "",
        startTime: item.startTime,
        duration: item.duration,
        name: item.name,
        track: "overlay" as const,
        layerIndex: item.layerIndex ?? 0,
      }),
    ),
  ];

  const audio: LegacyClipInput[] = audioRoots.map((layer) => ({
    id: layer.id,
    kind: "audio" as const,
    audioTrackId: layer.id,
    assetId: layer.payload.assetId,
    laneId: "",
    startTime: layer.timing.start,
    duration: layer.timing.duration,
    name: layer.name ?? layer.id,
    track: "audio" as const,
  }));

  return [...main, ...overlayClips, ...audio];
}

/** Converts the original scene sequence and overlay sidecar into unified clips (pre-lane). */
export function migrateClipsFromLegacy(
  project: MotionProject,
  overlays: OverlaySceneItem[],
): TimelineClip[] {
  return migrateLegacyClipInputs(project, overlays).map((clip) =>
    toSceneClip(clip, ""),
  );
}

function createAudioLane(order: number, name?: string): TimelineLane {
  return {
    id: uid("lane"),
    kind: "audio",
    role: "audio",
    name: name ?? `Âm thanh ${order + 1}`,
    order,
  };
}

function shiftAudioLaneOrders(
  lanes: TimelineLane[],
  fromOrder: number,
  delta: number,
): TimelineLane[] {
  return lanes.map((lane) =>
    lane.kind === "audio" && lane.order >= fromOrder
      ? { ...lane, order: lane.order + delta }
      : lane,
  );
}

/**
 * Ensure every schema audioTrack has a TimelineClip on an audio lane.
 * Nếu có audio clip/track mà thiếu audio lane → tạo lane rồi remap.
 */
export function ensureAudioClipsFromTracks(
  project: MotionProject,
  lanes: TimelineLane[],
  clips: TimelineClip[],
): { lanes: TimelineLane[]; clips: TimelineClip[] } {
  const tracks = project.layers.filter(
    (layer): layer is Extract<MotionLayer, { type: "audio" }> =>
      layer.type === "audio",
  );
  const hasAudioClips = clips.some((clip) => clip.kind === "audio");
  if (tracks.length === 0 && !hasAudioClips) return { lanes, clips };

  let nextLanes = [...lanes];
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const nextClips = [...clips];
  const clipIds = new Set(nextClips.map((clip) => clip.id));
  const missing = tracks
    .filter((track) => !clipIds.has(track.id))
    .sort((a, b) => a.timing.start - b.timing.start);

  for (const track of missing) {
    const asset = assetsById.get(track.payload.assetId);
    const duration =
      asset && "duration" in asset && typeof asset.duration === "number"
        ? Math.max(0.5, asset.duration)
        : Math.max(0.5, track.timing.duration);
    const startTime = Math.max(0, track.timing.start);

    const placement = findFreeAudioLaneLocal(
      nextLanes,
      nextClips,
      startTime,
      duration,
      null,
    );

    let laneId = placement.laneId;
    if (placement.createNew || !laneId) {
      const lane = createAudioLane(placement.insertOrder);
      if (placement.insertOrder != null) {
        nextLanes = shiftAudioLaneOrders(nextLanes, placement.insertOrder, 1);
      }
      nextLanes = [...nextLanes, lane];
      laneId = lane.id;
    }

    nextClips.push({
      id: track.id,
      kind: "audio",
      audioTrackId: track.id,
      assetId: track.payload.assetId,
      laneId,
      startTime,
      duration,
      name: track.name ?? track.payload.assetId,
    });
  }

  // Remap / tạo lane cho audio clip thiếu lane hợp lệ.
  const resultClips: TimelineClip[] = [];
  for (const clip of nextClips) {
    if (clip.kind !== "audio") {
      resultClips.push(clip);
      continue;
    }
    const validIds = new Set(
      nextLanes.filter((lane) => lane.kind === "audio").map((lane) => lane.id),
    );
    if (validIds.has(clip.laneId)) {
      resultClips.push(clip);
      continue;
    }

    const placement = findFreeAudioLaneLocal(
      nextLanes,
      resultClips,
      clip.startTime,
      clip.duration,
      null,
    );
    let laneId = placement.laneId;
    if (placement.createNew || !laneId) {
      const lane = createAudioLane(placement.insertOrder);
      if (placement.insertOrder != null) {
        nextLanes = shiftAudioLaneOrders(nextLanes, placement.insertOrder, 1);
      }
      nextLanes = [...nextLanes, lane];
      laneId = lane.id;
    }
    resultClips.push({ ...clip, laneId });
  }

  return { lanes: nextLanes, clips: resultClips };
}

function findFreeAudioLaneLocal(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
): { laneId: string | null; createNew: boolean; insertOrder: number } {
  const sorted = lanes
    .filter((l) => l.kind === "audio")
    .sort((a, b) => a.order - b.order);

  const isFree = (laneId: string) =>
    !clips.some(
      (clip) =>
        clip.laneId === laneId &&
        startTime < clip.startTime + clip.duration &&
        clip.startTime < startTime + duration,
    );

  if (preferredLaneId && isFree(preferredLaneId)) {
    return { laneId: preferredLaneId, createNew: false, insertOrder: 0 };
  }

  for (const lane of sorted) {
    if (isFree(lane.id)) {
      return { laneId: lane.id, createNew: false, insertOrder: 0 };
    }
  }

  const maxOrder = sorted.reduce((max, lane) => Math.max(max, lane.order), -1);
  return { laneId: null, createNew: true, insertOrder: maxOrder + 1 };
}
