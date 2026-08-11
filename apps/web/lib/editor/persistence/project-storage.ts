import type { MotionProject } from "@motionvideo/motion-protocol";
import { parseProjectInput } from "@/lib/runtime/parse-project-input";
import type { OverlaySceneItem } from "@motionvideo/editor-core";
import {
  ensureAudioClipsFromTracks,
  migrateLanesAndClips,
  normalizeLaneOrders,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
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
import { getProjectStorageAdapter } from "@/lib/editor/persistence/storage-adapter";

export type { StoredProject } from "@/lib/editor/persistence/project-migrations";
export { CURRENT_STORAGE_VERSION, migrateStoredProject, overlaysFromClips };
export { SaveProjectError, isQuotaExceededError } from "@/lib/editor/persistence/storage-errors";
export {
  createLocalStorageProjectAdapter,
  getProjectStorageAdapter,
  setProjectStorageAdapterForTests,
  type ProjectStorageAdapter,
} from "@/lib/editor/persistence/storage-adapter";

export type EditorProjectSnapshot = {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
  /** Sidecar legacy — derive từ clips/lanes, không phải nguồn sự thật. */
  overlayScenes: OverlaySceneItem[];
};

type SaveProjectOptions = {
  overlayScenes?: OverlaySceneItem[];
  timelineClips?: TimelineClip[];
  timelineLanes?: TimelineLane[];
};

function loadStored(id: string): StoredProject | null {
  const adapter = getProjectStorageAdapter();
  const raw = adapter.get(id);
  if (!raw) return null;
  return parseStoredProjectRecord(raw);
}

/** Persist one project — does not rewrite other projects. */
export function saveProject(
  project: MotionProject,
  options: SaveProjectOptions | OverlaySceneItem[] = {},
): void {
  // Version-aware: legacy v2 projects are migrated to v3 before persisting.
  const parsed = parseProjectInput(project);
  const adapter = getProjectStorageAdapter();
  const previous = loadStored(parsed.metadata.id);
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

  const stored: StoredProject = {
    storageVersion: CURRENT_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    project: parsed,
    ...(timelineClips !== undefined ? { timelineClips } : {}),
    ...(timelineLanes !== undefined ? { timelineLanes } : {}),
    overlayScenes,
  };
  adapter.set(parsed.metadata.id, stored);
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
 * Không mutate localStorage (migrate in-memory only).
 */
export function loadEditorProjectSnapshot(id: string): EditorProjectSnapshot | null {
  const stored = loadStored(id);
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

export function loadTimelineClips(id: string): TimelineClip[] {
  return loadEditorProjectSnapshot(id)?.timelineClips ?? [];
}

export function loadTimelineLanes(id: string): TimelineLane[] {
  return loadEditorProjectSnapshot(id)?.timelineLanes ?? [];
}

export function loadTimelineState(id: string): {
  clips: TimelineClip[];
  lanes: TimelineLane[];
} {
  const snap = loadEditorProjectSnapshot(id);
  if (!snap) return { clips: [], lanes: [] };
  return { clips: snap.timelineClips, lanes: snap.timelineLanes };
}

export function deleteProject(id: string): void {
  getProjectStorageAdapter().delete(id);
}

export function listProjects(): StoredProject[] {
  const adapter = getProjectStorageAdapter();
  const out: StoredProject[] = [];
  for (const id of adapter.listIds()) {
    const stored = loadStored(id);
    if (stored) out.push(stored);
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
