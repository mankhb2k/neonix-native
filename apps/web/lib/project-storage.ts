import type { MotionProject } from "@motionvideo/motion-schema";

const STORAGE_KEY = "motionvideo.projects";

export type StoredProject = {
  savedAt: string;
  project: MotionProject;
};

function readAll(): Record<string, StoredProject> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredProject>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, StoredProject>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function saveProject(project: MotionProject) {
  const map = readAll();
  map[project.id] = { savedAt: new Date().toISOString(), project };
  writeAll(map);
}

export function loadProject(id: string): MotionProject | null {
  return readAll()[id]?.project ?? null;
}

export function listProjects(): StoredProject[] {
  return Object.values(readAll()).sort((a, b) =>
    a.savedAt < b.savedAt ? 1 : -1,
  );
}
