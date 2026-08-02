/**
 * Storage adapter seam — per-project keys (no whole-collection rewrite on save).
 */

import type { StoredProject } from "@/lib/editor/persistence/project-migrations";
import {
  isQuotaExceededError,
  SaveProjectError,
} from "@/lib/editor/persistence/storage-errors";

/** Legacy single-blob key (migration source only). */
export const LEGACY_COLLECTION_KEY = "motionvideo.projects";
export const PROJECT_INDEX_KEY = "motionvideo.projectIndex";
export const projectStorageKey = (id: string) => `motionvideo.project.${id}`;

export type ProjectStorageAdapter = {
  listIds(): string[];
  get(id: string): unknown | null;
  set(id: string, value: StoredProject): void;
  delete(id: string): void;
};

function readIndex(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROJECT_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  if (typeof window === "undefined") {
    throw new SaveProjectError("write", "localStorage unavailable");
  }
  try {
    window.localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(ids));
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

function setLocal(key: string, value: string): void {
  if (typeof window === "undefined") {
    throw new SaveProjectError("write", "localStorage unavailable");
  }
  try {
    window.localStorage.setItem(key, value);
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

/**
 * One-time (lazy) lift of legacy collection blob into per-project keys.
 * Does not delete the legacy blob until all entries are copied (safe upgrade).
 */
export function migrateLegacyCollectionIfNeeded(): void {
  if (typeof window === "undefined") return;
  const legacyRaw = window.localStorage.getItem(LEGACY_COLLECTION_KEY);
  if (!legacyRaw) return;
  try {
    const raw = JSON.parse(legacyRaw) as Record<string, unknown>;
    const index = new Set(readIndex());
    for (const [id, value] of Object.entries(raw)) {
      if (!id || value == null) continue;
      const key = projectStorageKey(id);
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
      index.add(id);
    }
    writeIndex([...index]);
  } catch {
    /* leave legacy intact if corrupt */
  }
}

export function createLocalStorageProjectAdapter(): ProjectStorageAdapter {
  return {
    listIds() {
      migrateLegacyCollectionIfNeeded();
      return readIndex();
    },
    get(id: string) {
      migrateLegacyCollectionIfNeeded();
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(projectStorageKey(id));
      if (!raw) {
        // Fallback: peek legacy blob without rewriting others
        try {
          const legacy = window.localStorage.getItem(LEGACY_COLLECTION_KEY);
          if (!legacy) return null;
          const map = JSON.parse(legacy) as Record<string, unknown>;
          return map[id] ?? null;
        } catch {
          return null;
        }
      }
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    },
    set(id: string, value: StoredProject) {
      migrateLegacyCollectionIfNeeded();
      setLocal(projectStorageKey(id), JSON.stringify(value));
      const index = readIndex();
      if (!index.includes(id)) {
        writeIndex([...index, id]);
      }
    },
    delete(id: string) {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(projectStorageKey(id));
      writeIndex(readIndex().filter((x) => x !== id));
      // Also remove from legacy blob if present (best-effort)
      try {
        const legacy = window.localStorage.getItem(LEGACY_COLLECTION_KEY);
        if (!legacy) return;
        const map = JSON.parse(legacy) as Record<string, unknown>;
        if (id in map) {
          delete map[id];
          window.localStorage.setItem(
            LEGACY_COLLECTION_KEY,
            JSON.stringify(map),
          );
        }
      } catch {
        /* ignore */
      }
    },
  };
}

let defaultAdapter: ProjectStorageAdapter | null = null;

export function getProjectStorageAdapter(): ProjectStorageAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createLocalStorageProjectAdapter();
  }
  return defaultAdapter;
}

/** Test helper — inject fake adapter. */
export function setProjectStorageAdapterForTests(
  adapter: ProjectStorageAdapter | null,
): void {
  defaultAdapter = adapter;
}
