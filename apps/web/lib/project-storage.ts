import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";

const STORAGE_KEY = "motionvideo.projects";

export type StoredProject = { savedAt: string; project: MotionProject };

function readAll(): Record<string, StoredProject> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, { savedAt?: unknown; project?: unknown }>;
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

function writeAll(projects: Record<string, StoredProject>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function saveProject(project: MotionProject): void {
  const parsed = parseMotionProject(project);
  const projects = readAll();
  projects[parsed.metadata.id] = { savedAt: new Date().toISOString(), project: parsed };
  writeAll(projects);
}

export function loadProject(id: string): MotionProject | null {
  const projects = readAll();
  const stored = projects[id];
  if (!stored) return null;
  writeAll(projects);
  return stored.project;
}

export function listProjects(): StoredProject[] {
  return Object.values(readAll()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
