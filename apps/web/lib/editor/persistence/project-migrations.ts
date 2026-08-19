import type { MotionProject } from "@motionvideo/motion-protocol";
import { parseProjectInput } from "@/lib/runtime/parse-project-input";
import type { WebProjectEnvelope } from "@/lib/editor/authoring/web-project-envelope";
import {
  parseOverlayScenes,
  type OverlaySceneItem,
} from "@motionvideo/editor-core";
import {
  migrateLanesAndClips,
  parseTimelineClips,
  parseTimelineLanes,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";

/** Phiên bản envelope persistence hiện tại. Tăng khi đổi schema lưu. */
export const CURRENT_STORAGE_VERSION = 3;

export type StoredProject = {
  /** Version envelope — thiếu thì coi là 0 (legacy). */
  storageVersion?: number;
  savedAt: string;
  project: MotionProject;
  envelope?: WebProjectEnvelope;
  overlayScenes?: OverlaySceneItem[];
  timelineClips?: TimelineClip[];
  timelineLanes?: TimelineLane[];
};

type RawStoredRecord = {
  storageVersion?: unknown;
  savedAt?: unknown;
  project?: unknown;
  overlayScenes?: unknown;
  timelineClips?: unknown;
  timelineLanes?: unknown;
  envelope?: unknown;
};

/**
 * Pure migrator: đưa record cũ về schema hiện tại.
 * Idempotent — gọi hai lần cho cùng kết quả.
 */
export function migrateStoredProject(record: StoredProject): StoredProject {
  const version = record.storageVersion ?? 0;
  if (version >= CURRENT_STORAGE_VERSION) {
    return {
      ...record,
      storageVersion: CURRENT_STORAGE_VERSION,
    };
  }

  // v0/v1 → v2: chuẩn hóa clips/lanes sang discriminated union.
  const { lanes, clips } = migrateLanesAndClips(
    record.project,
    record.overlayScenes ?? [],
    record.timelineClips ?? [],
    record.timelineLanes ?? [],
  );

  return {
    storageVersion: CURRENT_STORAGE_VERSION,
    savedAt: record.savedAt,
    project: record.project,
    timelineClips: clips,
    timelineLanes: lanes,
    // Sidecar overlay chỉ từ lane overlay (không gồm audio) — DATA-03.
    overlayScenes: overlaysFromClips(clips, lanes),
  };
}

/** Chỉ map clip trên lane overlay — không đưa audio vào sidecar legacy. */
export function overlaysFromClips(
  clips: TimelineClip[],
  lanes: TimelineLane[],
): OverlaySceneItem[] {
  const overlayLaneIds = new Set(
    lanes.filter((lane) => lane.kind === "visual" && lane.role === "overlay").map((lane) => lane.id),
  );
  const orderByLane = new Map(lanes.map((lane) => [lane.id, lane.order]));

  return clips
    .filter((clip) => {
      if (clip.kind === "audio") return false;
      if (overlayLaneIds.has(clip.laneId)) return true;
      return false;
    })
    .map((clip) => ({
      id: clip.id,
      name: clip.name,
      duration: clip.duration,
      startTime: clip.startTime,
      layerIndex: orderByLane.get(clip.laneId) ?? 0,
    }));
}

/** Parse một raw record; trả null nếu project không hợp lệ. */
export function parseStoredProjectRecord(raw: unknown): StoredProject | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as RawStoredRecord;
  try {
    const project = parseProjectInput(item.project);
    const timelineClips = parseTimelineClips(item.timelineClips);
    const timelineLanes = parseTimelineLanes(item.timelineLanes);
    const envelope =
      item.envelope &&
      typeof item.envelope === "object" &&
      "authoring" in (item.envelope as object)
        ? (item.envelope as WebProjectEnvelope)
        : undefined;
    const base: StoredProject = {
      storageVersion:
        typeof item.storageVersion === "number" && Number.isFinite(item.storageVersion)
          ? Math.floor(item.storageVersion)
          : 0,
      savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(),
      project,
      ...(envelope ? { envelope } : {}),
      overlayScenes: parseOverlayScenes(item.overlayScenes),
      ...(item.timelineClips === undefined ? {} : { timelineClips }),
      ...(item.timelineLanes === undefined ? {} : { timelineLanes }),
    };
    return migrateStoredProject(base);
  } catch {
    return null;
  }
}
