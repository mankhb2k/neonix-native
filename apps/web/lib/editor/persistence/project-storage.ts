import type { MotionProject } from "@motionvideo/motion-schema";
import { parseMotionProject } from "@motionvideo/motion-schema";
import type { OverlaySceneItem } from "@/lib/editor/overlay-scenes";
import {
  ensureAudioClipsFromTracks,
  migrateLanesAndClips,
  normalizeLaneOrders,
  type TimelineClip,
  type TimelineLane,
} from "@/lib/editor/timeline-clips";
import {
  CURRENT_STORAGE_VERSION,
  migrateStoredProject,
  overlaysFromClips,
  parseStoredProjectRecord,
  type StoredProject,
} from "@/lib/editor/persistence/project-migrations";
import {
  isQuotaExceededError,
  SaveProjectError,
} from "@/lib/editor/persistence/storage-errors";

export type { StoredProject } from "@/lib/editor/persistence/project-migrations";
export { CURRENT_STORAGE_VERSION, migrateStoredProject, overlaysFromClips };
export { SaveProjectError, isQuotaExceededError } from "@/lib/editor/persistence/storage-errors";

const STORAGE_KEY = "motionvideo.projects";

export type EditorProjectSnapshot = {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
  /** Sidecar legacy — derive từ clips/lanes, không phải nguồn sự thật. */
  overlayScenes: OverlaySceneItem[];
};

/** Đọc storage thuần — không ghi ngược, không destructive migration. */
function parseStored(): Record<string, StoredProject> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    const migrated: Record<string, StoredProject> = {};
    for (const item of Object.values(raw)) {
      const parsed = parseStoredProjectRecord(item);
      if (!parsed) continue;
      migrated[parsed.project.metadata.id] = parsed;
    }
    return migrated;
  } catch {
    return {};
  }
}

/** Ghi storage — bắt quota/write failure (Phase 8). */
function writeAll(projects: Record<string, StoredProject>): void {
  if (typeof window === "undefined") {
    throw new SaveProjectError("write", "localStorage unavailable");
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new SaveProjectError(
        "quota",
        "Không đủ dung lượng localStorage để lưu dự án.",
      );
    }
    throw new SaveProjectError(
      "write",
      error instanceof Error ? error.message : "Ghi localStorage thất bại.",
    );
  }
}

type SaveProjectOptions = {
  overlayScenes?: OverlaySceneItem[];
  timelineClips?: TimelineClip[];
  timelineLanes?: TimelineLane[];
};

/** Persist unified clips + lanes, retaining the legacy overlay sidecar for older readers.
 * Throws SaveProjectError khi quota/write fail — caller nên catch (autosave không crash UI).
 */
export function saveProject(
  project: MotionProject,
  options: SaveProjectOptions | OverlaySceneItem[] = {},
): void {
  const parsed = parseMotionProject(project);
  const projects = parseStored();
  const previous = projects[parsed.metadata.id];
  const opts = Array.isArray(options) ? { overlayScenes: options } : options;
  const timelineClips =
    opts.timelineClips !== undefined
      ? opts.timelineClips
      : previous?.timelineClips;
  const timelineLanes =
    opts.timelineLanes !== undefined
      ? opts.timelineLanes
      : previous?.timelineLanes;
  const overlayScenes =
    opts.overlayScenes !== undefined
      ? opts.overlayScenes
      : timelineClips !== undefined
        ? overlaysFromClips(timelineClips, timelineLanes ?? [])
        : (previous?.overlayScenes ?? []);

  projects[parsed.metadata.id] = {
    storageVersion: CURRENT_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    project: parsed,
    ...(timelineClips !== undefined ? { timelineClips } : {}),
    ...(timelineLanes !== undefined ? { timelineLanes } : {}),
    overlayScenes,
  };
  writeAll(projects);
}

/** saveProject an toàn cho autosave — nuốt lỗi, trả về ok/false. */
export function trySaveProject(
  project: MotionProject,
  options: SaveProjectOptions | OverlaySceneItem[] = {},
): { ok: true } | { ok: false; error: SaveProjectError } {
  try {
    saveProject(project, options);
    return { ok: true };
  } catch (error) {
    if (error instanceof SaveProjectError) return { ok: false, error };
    return {
      ok: false,
      error: new SaveProjectError(
        "write",
        error instanceof Error ? error.message : "Ghi thất bại",
      ),
    };
  }
}

/**
 * Load đầy đủ snapshot editor trong một lần đọc storage.
 * Không mutate localStorage.
 */
export function loadEditorProjectSnapshot(id: string): EditorProjectSnapshot | null {
  const projects = parseStored();
  const stored = projects[id];
  if (!stored) return null;

  const { lanes: migratedLanes, clips: migratedClips } = migrateLanesAndClips(
    stored.project,
    stored.overlayScenes ?? [],
    stored.timelineClips ?? [],
    stored.timelineLanes ?? [],
  );
  const { lanes: withAudioLanes, clips: withAudioClips } = ensureAudioClipsFromTracks(
    stored.project,
    migratedLanes,
    migratedClips,
  );
  const lanes = normalizeLaneOrders(withAudioLanes);
  const clips = withAudioClips;

  return {
    project: stored.project,
    timelineClips: clips,
    timelineLanes: lanes,
    overlayScenes: overlaysFromClips(clips, lanes),
  };
}

export function loadProject(id: string): MotionProject | null {
  return loadEditorProjectSnapshot(id)?.project ?? null;
}

export function loadOverlayScenes(id: string): OverlaySceneItem[] {
  return loadEditorProjectSnapshot(id)?.overlayScenes ?? [];
}

/** Returns no clips for legacy projects; the editor migrates their sidecar once. */
export function loadTimelineClips(id: string): TimelineClip[] {
  return loadEditorProjectSnapshot(id)?.timelineClips ?? [];
}

export function loadTimelineLanes(id: string): TimelineLane[] {
  return loadEditorProjectSnapshot(id)?.timelineLanes ?? [];
}

/** Load clips+lanes with migration for legacy saves. */
export function loadTimelineState(id: string): {
  clips: TimelineClip[];
  lanes: TimelineLane[];
} {
  const snap = loadEditorProjectSnapshot(id);
  if (!snap) return { clips: [], lanes: [] };
  return { clips: snap.timelineClips, lanes: snap.timelineLanes };
}

export function deleteProject(id: string): void {
  const projects = parseStored();
  delete projects[id];
  writeAll(projects);
}

export function listProjects(): StoredProject[] {
  return Object.values(parseStored()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
