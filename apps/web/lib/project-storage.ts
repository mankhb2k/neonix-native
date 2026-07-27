import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";

const STORAGE_KEY = "motionvideo.projects";
/** One-shot: wipe seeded hook/offer/cta (and any) timeline scenes → empty canvas. */
const EMPTY_TIMELINE_FLAG = "motionvideo.emptyTimeline.v1";

export type StoredProject = { savedAt: string; project: MotionProject };

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
      { savedAt?: unknown; project?: unknown }
    >;
    const migrated: Record<string, StoredProject> = {};
    for (const item of Object.values(raw)) {
      try {
        const project = parseMotionProject(item.project);
        migrated[project.metadata.id] = {
          savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(),
          project,
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

export function saveProject(project: MotionProject): void {
  const parsed = parseMotionProject(project);
  const projects = parseStored();
  projects[parsed.metadata.id] = { savedAt: new Date().toISOString(), project: parsed };
  writeAll(projects);
}

export function loadProject(id: string): MotionProject | null {
  const projects = readAll();
  const stored = projects[id];
  if (!stored) return null;
  return stored.project;
}

export function deleteProject(id: string): void {
  const projects = parseStored();
  delete projects[id];
  writeAll(projects);
}

export function listProjects(): StoredProject[] {
  return Object.values(readAll()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

