import type { MotionProject } from "@motionvideo/motion-schema";
import type { OverlaySceneItem } from "@/lib/overlay-scenes";

export type TimelineLaneKind = "main" | "overlay";

export type TimelineLane = {
  id: string;
  kind: TimelineLaneKind;
  name: string;
  order: number;
};

/** @deprecated Prefer laneId; kept for migrate/parse of older saves. */
export type TimelineTrackKind = "main" | "overlay";

export type TimelineClip = {
  id: string;
  sceneId: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
  /** @deprecated migrated into laneId */
  track?: TimelineTrackKind;
  /** @deprecated migrated into lane */
  layerIndex?: number;
};

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function parseTimelineLanes(input: unknown): TimelineLane[] {
  if (!Array.isArray(input)) return [];
  const lanes: TimelineLane[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      (row.kind !== "main" && row.kind !== "overlay") ||
      typeof row.name !== "string" ||
      !validNumber(row.order)
    ) {
      continue;
    }
    lanes.push({
      id: row.id,
      kind: row.kind,
      name: row.name,
      order: Math.floor(row.order),
    });
  }
  return lanes;
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
      typeof row.name !== "string" ||
      !validNumber(row.startTime) ||
      !validNumber(row.duration)
    ) {
      continue;
    }
    const hasLaneId = typeof row.laneId === "string";
    const hasLegacyTrack = row.track === "main" || row.track === "overlay";
    if (!hasLaneId && !hasLegacyTrack) continue;
    if (row.layerIndex !== undefined && (!validNumber(row.layerIndex) || row.layerIndex < 0)) {
      continue;
    }
    clips.push({
      id: row.id,
      sceneId: row.sceneId,
      laneId: hasLaneId ? (row.laneId as string) : "",
      startTime: Math.max(0, row.startTime),
      duration: Math.max(0, row.duration),
      name: row.name,
      ...(hasLegacyTrack ? { track: row.track as TimelineTrackKind } : {}),
      ...(row.layerIndex === undefined
        ? {}
        : { layerIndex: Math.floor(row.layerIndex as number) }),
    });
  }
  return clips;
}

export function ensureMainLane(lanes: TimelineLane[]): TimelineLane {
  const existing = lanes.find((lane) => lane.kind === "main");
  if (existing) return existing;
  return { id: uid("lane"), kind: "main", name: "Main", order: -1 };
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
    if (!lanes.some((lane) => lane.kind === "main")) {
      lanes.push(ensureMainLane(lanes));
    }
    if (storedClips.length > 0 || storedLanes.some((l) => l.kind === "main")) {
      return { lanes, clips: storedClips };
    }
  }

  const legacyClips =
    storedClips.length > 0
      ? storedClips
      : migrateClipsFromLegacy(project, overlays);

  const mainLane = ensureMainLane(storedLanes.filter((l) => l.kind === "main"));
  const layerToLane = new Map<number, TimelineLane>();
  const overlayLanes: TimelineLane[] = [];

  for (const clip of legacyClips) {
    if (clip.track === "overlay" || (clip.laneId === "" && clip.layerIndex != null)) {
      const idx = clip.layerIndex ?? 0;
      if (!layerToLane.has(idx)) {
        const lane: TimelineLane = {
          id: uid("lane"),
          kind: "overlay",
          name: `Lớp ${idx + 1}`,
          order: idx,
        };
        layerToLane.set(idx, lane);
        overlayLanes.push(lane);
      }
    }
  }

  // Prefer existing overlay lanes from storage if any
  const existingOverlay = storedLanes.filter((l) => l.kind === "overlay");
  const lanes =
    existingOverlay.length > 0 && layerToLane.size === 0
      ? [mainLane, ...existingOverlay]
      : [mainLane, ...overlayLanes.sort((a, b) => a.order - b.order)];

  const clips: TimelineClip[] = legacyClips.map((clip) => {
    if (clip.laneId) {
      return {
        id: clip.id,
        sceneId: clip.sceneId,
        laneId: clip.laneId,
        startTime: clip.startTime,
        duration: clip.duration,
        name: clip.name,
      };
    }
    if (clip.track === "overlay") {
      const idx = clip.layerIndex ?? 0;
      const lane = layerToLane.get(idx) ?? overlayLanes[0] ?? mainLane;
      return {
        id: clip.id,
        sceneId: clip.sceneId,
        laneId: lane.id,
        startTime: clip.startTime,
        duration: clip.duration,
        name: clip.name,
      };
    }
    return {
      id: clip.id,
      sceneId: clip.sceneId,
      laneId: mainLane.id,
      startTime: clip.startTime,
      duration: clip.duration,
      name: clip.name,
    };
  });

  return { lanes, clips };
}

/** Converts the original scene sequence and overlay sidecar into unified clips (pre-lane). */
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
      laneId: "",
      track: "main",
      startTime,
      duration: scene.duration,
      name: scene.name ?? scene.semantic?.role ?? scene.id,
    };
    startTime += scene.duration;
    return [clip];
  });
  const overlay = overlays.map(
    (item): TimelineClip => ({
      id: item.id,
      sceneId: item.id,
      laneId: "",
      track: "overlay",
      layerIndex: item.layerIndex,
      startTime: item.startTime,
      duration: item.duration,
      name: item.name,
    }),
  );
  return [...main, ...overlay];
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

export function laneKind(
  lanes: TimelineLane[],
  laneId: string,
): TimelineLaneKind | null {
  return lanes.find((lane) => lane.id === laneId)?.kind ?? null;
}

export function isMainLane(lanes: TimelineLane[], laneId: string): boolean {
  return laneKind(lanes, laneId) === "main";
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
    .filter((lane) => lane.kind === "overlay")
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

export function createOverlayLane(
  order: number,
  name?: string,
): TimelineLane {
  return {
    id: uid("lane"),
    kind: "overlay",
    name: name ?? `Lớp ${order + 1}`,
    order,
  };
}

/** Drop overlay lanes that have no clips; keep main; renumber overlay order. */
export function pruneEmptyOverlayLanes(
  lanes: TimelineLane[],
  clips: TimelineClip[],
): TimelineLane[] {
  const used = new Set(clips.map((clip) => clip.laneId));
  const main = lanes.find((lane) => lane.kind === "main") ?? ensureMainLane([]);
  const overlays = lanes
    .filter((lane) => lane.kind === "overlay" && used.has(lane.id))
    .sort((a, b) => a.order - b.order)
    .map((lane, index) => ({ ...lane, order: index }));
  return [main, ...overlays];
}

/** Place on main without time-overlap. */
export function resolveMainStartTime(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  startTime: number,
  duration: number,
): number {
  const mainId = lanes.find((lane) => lane.kind === "main")?.id;
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
    lane.kind === "overlay" && lane.order >= fromOrder
      ? { ...lane, order: lane.order + delta }
      : lane,
  );
}

export function reorderOverlayLane(
  lanes: TimelineLane[],
  laneId: string,
  newOrder: number,
): TimelineLane[] {
  const target = lanes.find((lane) => lane.id === laneId && lane.kind === "overlay");
  if (!target) return lanes;
  const clamped = Math.max(0, Math.floor(newOrder));
  const others = lanes
    .filter((lane) => lane.kind === "overlay" && lane.id !== laneId)
    .sort((a, b) => a.order - b.order);
  others.splice(Math.min(clamped, others.length), 0, target);
  const remapped = others.map((lane, index) => ({ ...lane, order: index }));
  return lanes.map((lane) => {
    if (lane.kind !== "overlay") return lane;
    return remapped.find((item) => item.id === lane.id) ?? lane;
  });
}

/** Legacy helper — maps preferred numeric layer to free overlay lane result. */
export function findFreeOverlayLayer(
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLayer: number,
  insertNewLayer: boolean,
): { layerIndex: number; insertNewLayer: boolean } {
  const requested = Math.max(0, Math.floor(preferredLayer));
  if (insertNewLayer) return { layerIndex: requested, insertNewLayer: true };

  const byLane = new Map<string, TimelineClip[]>();
  for (const clip of clips) {
    if (!clip.laneId) continue;
    const list = byLane.get(clip.laneId) ?? [];
    list.push(clip);
    byLane.set(clip.laneId, list);
  }

  // Fallback when only legacy layerIndex exists on clips
  const overlays = clips.filter(
    (clip) => clip.track === "overlay" || clip.layerIndex != null,
  );
  const isFree = (layerIndex: number) =>
    !overlays.some(
      (clip) =>
        (clip.layerIndex ?? 0) === layerIndex &&
        rangesOverlap(startTime, duration, clip.startTime, clip.duration),
    );

  if (isFree(requested)) return { layerIndex: requested, insertNewLayer: false };
  const maxLayer = overlays.reduce(
    (max, clip) => Math.max(max, clip.layerIndex ?? 0),
    -1,
  );
  for (let layer = 0; layer <= maxLayer; layer++) {
    if (isFree(layer)) return { layerIndex: layer, insertNewLayer: false };
  }
  return { layerIndex: maxLayer + 1, insertNewLayer: false };
}
