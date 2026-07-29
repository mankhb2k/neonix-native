import type { MotionProject } from "@motionvideo/motion-schema";
import type { OverlaySceneItem } from "@/lib/editor/overlay-scenes";
import {
  DEFAULT_VISUAL_POLICY,
  type AudioTimelineClip,
  type SceneTimelineClip,
  type TimelineClip,
  type TimelineLane,
  type TimelineTrackKind,
  type VisualLanePolicy,
} from "@/lib/editor/model/timeline-types";

export type {
  AudioTimelineClip,
  AudioTimelineLane,
  SceneTimelineClip,
  TimelineClip,
  TimelineLane,
  TimelineTrackKind,
  VisualLanePolicy,
  VisualTimelineLane,
} from "@/lib/editor/model/timeline-types";

export {
  DEFAULT_VISUAL_POLICY,
  isAudioClip,
  isBaseLaneObj,
  isOverlayLaneObj,
  isSceneClip,
  isVisualLane,
} from "@/lib/editor/model/timeline-types";

/** Compatibility alias — UI cũ dùng TimelineLaneKind. */
export type TimelineLaneKind = "visual" | "audio" | "main" | "overlay";

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function parsePolicy(raw: unknown): VisualLanePolicy {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_VISUAL_POLICY };
  const row = raw as Record<string, unknown>;
  return {
    allowOverlap: false,
    rippleMode: row.rippleMode === true,
  };
}

/** Parse lane — chấp nhận legacy main/overlay/audio và visual+role. */
export function parseTimelineLanes(input: unknown): TimelineLane[] {
  if (!Array.isArray(input)) return [];
  const lanes: TimelineLane[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.name !== "string" || !validNumber(row.order)) {
      continue;
    }
    const order = Math.floor(row.order);
    const locked = row.locked === true;
    const visible = row.visible !== false;
    const muted = row.muted === true;

    // Format mới
    if (row.kind === "visual" && (row.role === "base" || row.role === "overlay")) {
      lanes.push({
        id: row.id,
        kind: "visual",
        role: row.role,
        name: row.name,
        order,
        policy: parsePolicy(row.policy),
        ...(locked ? { locked: true } : {}),
        ...(row.visible === false ? { visible: false } : {}),
      });
      continue;
    }
    if (row.kind === "audio" || (row.kind === "audio" && row.role === "audio")) {
      lanes.push({
        id: row.id,
        kind: "audio",
        role: "audio",
        name: row.name,
        order,
        ...(locked ? { locked: true } : {}),
        ...(muted ? { muted: true } : {}),
      });
      continue;
    }

    // Legacy: main / overlay / audio
    if (row.kind === "main") {
      lanes.push({
        id: row.id,
        kind: "visual",
        role: "base",
        name: row.name,
        order,
        policy: { ...DEFAULT_VISUAL_POLICY },
      });
      continue;
    }
    if (row.kind === "overlay") {
      lanes.push({
        id: row.id,
        kind: "visual",
        role: "overlay",
        name: row.name,
        order,
        policy: { ...DEFAULT_VISUAL_POLICY },
        ...(visible === false ? { visible: false } : {}),
        ...(locked ? { locked: true } : {}),
      });
      continue;
    }
    if (row.kind === "audio") {
      lanes.push({
        id: row.id,
        kind: "audio",
        role: "audio",
        name: row.name,
        order,
        ...(locked ? { locked: true } : {}),
        ...(muted ? { muted: true } : {}),
      });
    }
  }
  return lanes;
}

/** Parse clips — chấp nhận kind mới và legacy sceneId-only. */
export function parseTimelineClips(input: unknown): TimelineClip[] {
  if (!Array.isArray(input)) return [];
  const clips: TimelineClip[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      !validNumber(row.startTime) ||
      !validNumber(row.duration)
    ) {
      continue;
    }
    const hasLaneId = typeof row.laneId === "string";
    const hasLegacyTrack =
      row.track === "main" || row.track === "overlay" || row.track === "audio";
    if (!hasLaneId && !hasLegacyTrack) continue;

    const startTime = Math.max(0, row.startTime);
    const duration = Math.max(0, row.duration);
    const laneId = hasLaneId ? (row.laneId as string) : "";

    // Audio clip mới
    if (
      row.kind === "audio" ||
      row.track === "audio" ||
      (typeof row.audioTrackId === "string" && typeof row.assetId === "string")
    ) {
      const audioTrackId =
        typeof row.audioTrackId === "string"
          ? row.audioTrackId
          : typeof row.sceneId === "string"
            ? row.sceneId
            : row.id;
      const assetId =
        typeof row.assetId === "string"
          ? row.assetId
          : typeof row.name === "string"
            ? row.name
            : audioTrackId;
      clips.push({
        id: row.id,
        kind: "audio",
        sceneId: "",
        audioTrackId,
        assetId,
        laneId,
        startTime,
        duration,
        name: row.name,
      });
      continue;
    }

    // Scene clip (mặc định)
    const sceneId =
      typeof row.sceneId === "string"
        ? row.sceneId
        : row.id;
    clips.push({
      id: row.id,
      kind: "scene",
      sceneId,
      laneId,
      startTime,
      duration,
      name: row.name,
    });
  }
  return clips;
}

export function ensureMainLane(lanes: TimelineLane[]): TimelineLane {
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
  if (
    storedLanes.length > 0 &&
    storedClips.every((clip) => Boolean(clip.laneId))
  ) {
    const lanes = [...storedLanes];
    if (!lanes.some((lane) => lane.kind === "visual" && lane.role === "base")) {
      lanes.push(ensureMainLane(lanes));
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

  const mainLane = ensureMainLane(
    storedLanes.filter((l) => l.kind === "visual" && l.role === "base"),
  );
  const layerToLane = new Map<number, TimelineLane>();
  const overlayLanes: TimelineLane[] = [];

  for (const clip of rawLegacy) {
    if (clip.track === "overlay" || (clip.laneId === "" && clip.layerIndex != null)) {
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
  const lanes =
    existingOverlay.length > 0 && layerToLane.size === 0
      ? [mainLane, ...existingOverlay]
      : [mainLane, ...overlayLanes.sort((a, b) => a.order - b.order)];

  const clips: TimelineClip[] = rawLegacy.map((clip) => {
    if (clip.kind === "audio" || clip.track === "audio") {
      const audio: TimelineClip = {
        id: clip.id,
        kind: "audio",
        sceneId: "",
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

/**
 * Legacy → clip inputs kèm track/layerIndex (chưa gán laneId).
 * Overlay sidecar không được đưa vào base sceneOrder.
 */
function migrateLegacyClipInputs(
  project: MotionProject,
  overlays: OverlaySceneItem[],
): LegacyClipInput[] {
  const overlayIds = new Set(overlays.map((item) => item.id));
  const scenesById = new Map(project.scenes.map((scene) => [scene.id, scene]));
  let startTime = 0;
  const main = project.timeline.sceneOrder.flatMap((sceneId) => {
    if (overlayIds.has(sceneId)) return [];
    const scene = scenesById.get(sceneId);
    if (!scene) return [];
    const clip: LegacyClipInput = {
      id: scene.id,
      kind: "scene",
      sceneId: scene.id,
      laneId: "",
      startTime,
      duration: scene.duration,
      name: scene.name ?? scene.semantic?.role ?? scene.id,
      track: "main",
    };
    startTime += scene.duration;
    return [clip];
  });
  const overlay = overlays.map(
    (item): LegacyClipInput => ({
      id: item.id,
      kind: "scene",
      sceneId: item.id,
      laneId: "",
      startTime: item.startTime,
      duration: item.duration,
      name: item.name,
      track: "overlay",
      layerIndex: item.layerIndex ?? 0,
    }),
  );
  return [...main, ...overlay];
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

export function clipsContentEndSeconds(clips: TimelineClip[]): number {
  return clips.reduce(
    (end, clip) =>
      Math.max(end, Math.max(0, clip.startTime) + Math.max(0, clip.duration)),
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

export function isMainLane(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "visual" && lane.role === "base");
}

export function isAudioLane(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "audio");
}

export function isOverlayLane(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "visual" && lane.role === "overlay");
}

export function laneRippleMode(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane && lane.kind === "visual" && lane.policy.rippleMode);
}

export function isLaneLocked(lanes: TimelineLane[], laneId: string): boolean {
  const lane = lanes.find((l) => l.id === laneId);
  return Boolean(lane?.locked);
}

/** Find overlay lane without time overlap, or signal create-new. */
export function findFreeOverlayLane(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNewLane: boolean,
  preferredInsertOrder?: number | null,
): { laneId: string | null; createNew: boolean; insertOrder: number } {
  const overlays = lanes
    .filter((lane) => lane.kind === "visual" && lane.role === "overlay")
    .sort((a, b) => a.order - b.order);

  if (insertNewLane) {
    if (preferredInsertOrder != null && Number.isFinite(preferredInsertOrder)) {
      return {
        laneId: null,
        createNew: true,
        insertOrder: Math.max(0, Math.floor(preferredInsertOrder)),
      };
    }
    const preferred = preferredLaneId
      ? overlays.find((lane) => lane.id === preferredLaneId)
      : undefined;
    const insertOrder = preferred ? preferred.order + 1 : overlays.length;
    return { laneId: null, createNew: true, insertOrder };
  }

  const isFree = (laneId: string) =>
    !clips.some(
      (clip) =>
        clip.laneId === laneId &&
        rangesOverlap(startTime, duration, clip.startTime, clip.duration),
    );

  if (preferredLaneId && isFree(preferredLaneId)) {
    return { laneId: preferredLaneId, createNew: false, insertOrder: 0 };
  }

  for (const lane of overlays) {
    if (isFree(lane.id)) {
      return { laneId: lane.id, createNew: false, insertOrder: 0 };
    }
  }

  const maxOrder = overlays.reduce((max, lane) => Math.max(max, lane.order), -1);
  return { laneId: null, createNew: true, insertOrder: maxOrder + 1 };
}

export function createOverlayLane(order: number, name?: string): TimelineLane {
  return {
    id: uid("lane"),
    kind: "visual",
    role: "overlay",
    name: name ?? `Lớp ${order + 1}`,
    order,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

/** Drop overlay lanes that have no clips; keep base + audio; renumber overlay order. */
export function pruneEmptyOverlayLanes(
  lanes: TimelineLane[],
  clips: TimelineClip[],
): TimelineLane[] {
  const used = new Set(clips.map((clip) => clip.laneId));
  const main =
    lanes.find((lane) => lane.kind === "visual" && lane.role === "base") ??
    ensureMainLane([]);
  const overlays = lanes
    .filter(
      (lane) =>
        lane.kind === "visual" && lane.role === "overlay" && used.has(lane.id),
    )
    .sort((a, b) => a.order - b.order)
    .map((lane, index) => ({ ...lane, order: index }));
  const audio = lanes
    .filter((lane) => lane.kind === "audio")
    .sort((a, b) => a.order - b.order);
  return [main, ...overlays, ...audio];
}

export function findFreeAudioLane(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNewLane: boolean,
  preferredInsertOrder?: number | null,
): { laneId: string | null; createNew: boolean; insertOrder: number } {
  const audios = lanes
    .filter((lane) => lane.kind === "audio")
    .sort((a, b) => a.order - b.order);

  if (insertNewLane) {
    if (preferredInsertOrder != null && Number.isFinite(preferredInsertOrder)) {
      return {
        laneId: null,
        createNew: true,
        insertOrder: Math.max(0, Math.floor(preferredInsertOrder)),
      };
    }
    const preferred = preferredLaneId
      ? audios.find((lane) => lane.id === preferredLaneId)
      : undefined;
    const insertOrder = preferred ? preferred.order + 1 : audios.length;
    return { laneId: null, createNew: true, insertOrder };
  }

  const isFree = (laneId: string) =>
    !clips.some(
      (clip) =>
        clip.laneId === laneId &&
        rangesOverlap(startTime, duration, clip.startTime, clip.duration),
    );

  if (preferredLaneId && isFree(preferredLaneId)) {
    return { laneId: preferredLaneId, createNew: false, insertOrder: 0 };
  }

  for (const lane of audios) {
    if (isFree(lane.id)) {
      return { laneId: lane.id, createNew: false, insertOrder: 0 };
    }
  }

  const maxOrder = audios.reduce((max, lane) => Math.max(max, lane.order), -1);
  return { laneId: null, createNew: true, insertOrder: maxOrder + 1 };
}

export function createAudioLane(order: number, name?: string): TimelineLane {
  return {
    id: uid("lane"),
    kind: "audio",
    role: "audio",
    name: name ?? `Âm thanh ${order + 1}`,
    order,
  };
}

export function pruneEmptyAudioLanes(
  lanes: TimelineLane[],
  clips: TimelineClip[],
): TimelineLane[] {
  const used = new Set(clips.map((clip) => clip.laneId));
  const main =
    lanes.find((lane) => lane.kind === "visual" && lane.role === "base") ??
    ensureMainLane([]);
  const overlays = lanes
    .filter((lane) => lane.kind === "visual" && lane.role === "overlay")
    .sort((a, b) => a.order - b.order);
  const audios = lanes
    .filter((lane) => lane.kind === "audio" && used.has(lane.id))
    .sort((a, b) => a.order - b.order)
    .map((lane, index) => ({ ...lane, order: index }));
  return [main, ...overlays, ...audios];
}

export function pruneEmptyLanes(
  lanes: TimelineLane[],
  clips: TimelineClip[],
): TimelineLane[] {
  return pruneEmptyAudioLanes(pruneEmptyOverlayLanes(lanes, clips), clips);
}

export function shiftAudioLaneOrders(
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
 * Mỗi track đặt vào lane trống; overlap → tạo lane mới (MODEL-03).
 */
export function ensureAudioClipsFromTracks(
  project: MotionProject,
  lanes: TimelineLane[],
  clips: TimelineClip[],
): { lanes: TimelineLane[]; clips: TimelineClip[] } {
  const tracks = project.timeline.audioTracks ?? [];
  if (tracks.length === 0) return { lanes, clips };

  const clipIds = new Set(clips.map((clip) => clip.id));
  const missing = tracks.filter((track) => !clipIds.has(track.id));
  if (missing.length === 0) {
    const hasAudioClip = clips.some(
      (clip) =>
        clip.kind === "audio" &&
        tracks.some((track) => track.id === clip.audioTrackId || track.id === clip.id),
    );
    if (!hasAudioClip || lanes.some((lane) => lane.kind === "audio")) {
      return { lanes, clips };
    }
  }

  let nextLanes = [...lanes];
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const nextClips = [...clips];
  const orderedMissing = [...missing].sort((a, b) => a.start - b.start);

  for (const track of orderedMissing) {
    const asset = assetsById.get(track.assetId);
    const duration =
      asset && "duration" in asset && typeof asset.duration === "number"
        ? Math.max(0.5, asset.duration)
        : 10;
    const startTime = Math.max(0, track.start);

    const placement = findFreeAudioLane(
      nextLanes,
      nextClips,
      startTime,
      duration,
      null,
      false,
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
      sceneId: "",
      audioTrackId: track.id,
      assetId: track.assetId,
      laneId,
      startTime,
      duration,
      name: track.assetId,
    });
  }

  const audioLaneIds = new Set(
    nextLanes.filter((lane) => lane.kind === "audio").map((lane) => lane.id),
  );
  const remapped = nextClips.map((clip) => {
    if (clip.kind !== "audio") return clip;
    if (!tracks.some((track) => track.id === clip.audioTrackId || track.id === clip.id)) {
      return clip;
    }
    if (audioLaneIds.has(clip.laneId)) return clip;
    const fallback = nextLanes.find((lane) => lane.kind === "audio");
    return fallback ? { ...clip, laneId: fallback.id } : clip;
  });

  return { lanes: nextLanes, clips: remapped };
}

/** Place on base lane without time-overlap (trừ khi ripple). */
export function resolveMainStartTime(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  startTime: number,
  duration: number,
): number {
  const mainId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  const main = clips
    .filter((clip) => clip.laneId === mainId)
    .sort((a, b) => a.startTime - b.startTime);
  let t = Math.max(0, startTime);
  for (const clip of main) {
    if (!rangesOverlap(t, duration, clip.startTime, clip.duration)) continue;
    t = clip.startTime + clip.duration;
  }
  return t;
}

export function shiftOverlayLaneOrders(
  lanes: TimelineLane[],
  fromOrder: number,
  delta: number,
): TimelineLane[] {
  return lanes.map((lane) =>
    lane.kind === "visual" &&
    lane.role === "overlay" &&
    lane.order >= fromOrder
      ? { ...lane, order: lane.order + delta }
      : lane,
  );
}

export function reorderOverlayLane(
  lanes: TimelineLane[],
  laneId: string,
  newOrder: number,
): TimelineLane[] {
  const target = lanes.find(
    (lane) =>
      lane.id === laneId && lane.kind === "visual" && lane.role === "overlay",
  );
  if (!target) return lanes;
  const clamped = Math.max(0, Math.floor(newOrder));
  const others = lanes
    .filter(
      (lane) =>
        lane.kind === "visual" &&
        lane.role === "overlay" &&
        lane.id !== laneId,
    )
    .sort((a, b) => a.order - b.order);
  others.splice(Math.min(clamped, others.length), 0, target);
  const remapped = others.map((lane, index) => ({ ...lane, order: index }));
  return lanes.map((lane) => {
    if (lane.kind !== "visual" || lane.role !== "overlay") return lane;
    return remapped.find((item) => item.id === lane.id) ?? lane;
  });
}

/** @deprecated Prefer findFreeOverlayLane. */
export function findFreeOverlayLayer(
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLayer: number,
  insertNewLayer: boolean,
): { layerIndex: number; insertNewLayer: boolean } {
  const requested = Math.max(0, Math.floor(preferredLayer));
  if (insertNewLayer) return { layerIndex: requested, insertNewLayer: true };
  void clips;
  void startTime;
  void duration;
  return { layerIndex: requested, insertNewLayer: false };
}
