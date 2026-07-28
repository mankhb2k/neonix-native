import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";
import {
  parseOverlayScenes,
  type OverlaySceneItem,
} from "@/lib/overlay-scenes";
import {
  parseTimelineClips,
  type TimelineClip,
} from "@/lib/timeline-clips";

const STORAGE_KEY = "motionvideo.projects";
/** One-shot: wipe seeded hook/offer/cta (and any) timeline scenes → empty canvas. */
const EMPTY_TIMELINE_FLAG = "motionvideo.emptyTimeline.v1";

export type StoredProject = {
  savedAt: string;
  project: MotionProject;
  overlayScenes?: OverlaySceneItem[];
  timelineClips?: TimelineClip[];
};

function withEmptyTimeline(project: MotionProject): MotionProject {
  return parseMotionProject({
    ...project,
    scenes: [],
    timeline: {
      ...project.timeline,
      sceneOrder: [],
      audioTracks: project.timeline.audioTracks ?? [],
    },
    bindings: [],
  });
}

function parseStored(): Record<string, StoredProject> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      {
        savedAt?: unknown;
        project?: unknown;
        overlayScenes?: unknown;
        timelineClips?: unknown;
      }
    >;
    const migrated: Record<string, StoredProject> = {};
    for (const item of Object.values(raw)) {
      try {
        const project = parseMotionProject(item.project);
        const timelineClips = parseTimelineClips(item.timelineClips);
        migrated[project.metadata.id] = {
          savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(),
          project,
          overlayScenes: parseOverlayScenes(item.overlayScenes),
          ...(item.timelineClips === undefined ? {} : { timelineClips }),
        };
      } catch {
        // One corrupt item must not hide every valid project.
      }
    }
    return migrated;
  } catch {
    return {};
  }
}

function emptyAllTimelines(projects: Record<string, StoredProject>): Record<string, StoredProject> {
  const now = new Date().toISOString();
  const emptied: Record<string, StoredProject> = {};
  for (const [id, stored] of Object.entries(projects)) {
    emptied[id] = {
      savedAt: now,
      project: withEmptyTimeline(stored.project),
      overlayScenes: stored.overlayScenes ?? [],
      timelineClips: stored.timelineClips?.filter((clip) => clip.track === "overlay") ?? [],
    };
  }
  return emptied;
}

/** Load path only — never call from saveProject (avoids rewriting emptied data). */
function readAll(): Record<string, StoredProject> {
  if (typeof window === "undefined") return {};
  const projects = parseStored();
  if (window.localStorage.getItem(EMPTY_TIMELINE_FLAG) === "1") {
    return projects;
  }
  const emptied = emptyAllTimelines(projects);
  writeAll(emptied);
  window.localStorage.setItem(EMPTY_TIMELINE_FLAG, "1");
  return emptied;
}

function writeAll(projects: Record<string, StoredProject>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function overlaysFromClips(clips: TimelineClip[]): OverlaySceneItem[] {
  return clips
    .filter((clip) => clip.track === "overlay")
    .map((clip) => ({
      id: clip.id,
      name: clip.name,
      duration: clip.duration,
      startTime: clip.startTime,
      layerIndex: clip.layerIndex ?? 0,
    }));
}

type SaveProjectOptions = {
  overlayScenes?: OverlaySceneItem[];
  timelineClips?: TimelineClip[];
};

/** Persist unified clips, retaining the legacy overlay sidecar for older readers. */
export function saveProject(
  project: MotionProject,
  options: SaveProjectOptions | OverlaySceneItem[] = {},
): void {
  const parsed = parseMotionProject(project);
  const projects = parseStored();
  const previous = projects[parsed.metadata.id];
  const opts = Array.isArray(options) ? { overlayScenes: options } : options;
  const timelineClips = opts.timelineClips !== undefined
    ? parseTimelineClips(opts.timelineClips)
    : previous?.timelineClips;
  projects[parsed.metadata.id] = {
    savedAt: new Date().toISOString(),
    project: parsed,
    ...(timelineClips !== undefined ? { timelineClips } : {}),
    overlayScenes: opts.overlayScenes !== undefined
      ? opts.overlayScenes
      : timelineClips !== undefined
        ? overlaysFromClips(timelineClips)
        : (previous?.overlayScenes ?? []),
  };
  writeAll(projects);
}

export function loadProject(id: string): MotionProject | null {
  const projects = readAll();
  const stored = projects[id];
  if (!stored) return null;
  return stored.project;
}

export function loadOverlayScenes(id: string): OverlaySceneItem[] {
  const projects = readAll();
  return projects[id]?.overlayScenes ?? [];
}

/** Returns no clips for legacy projects; the editor migrates their sidecar once. */
export function loadTimelineClips(id: string): TimelineClip[] {
  const projects = readAll();
  return projects[id]?.timelineClips ?? [];
}

export function deleteProject(id: string): void {
  const projects = parseStored();
  delete projects[id];
  writeAll(projects);
}

export function listProjects(): StoredProject[] {
  return Object.values(readAll()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
