/**
 * Recent projects list — userData JSON (not localStorage).
 */

import fs from "node:fs";
import path from "node:path";
import type { RecentProject } from "../../shared/ipc/contracts";

const MAX_RECENT = 20;

export type RecentProjectStoreFs = {
  existsSync(p: string): boolean;
  readFileSync(p: string, encoding: BufferEncoding): string;
  writeFileSync(p: string, data: string): void;
  mkdirSync(p: string, opts?: { recursive?: boolean }): void;
};

export type RecentProjectServiceOptions = {
  userDataPath: string;
  fs?: RecentProjectStoreFs;
  /** When true, drop entries whose path no longer exists. */
  pruneMissing?: boolean;
  pathExists?: (p: string) => boolean;
};

function defaultFs(): RecentProjectStoreFs {
  return {
    existsSync: fs.existsSync,
    readFileSync: (p, encoding) => fs.readFileSync(p, encoding),
    writeFileSync: (p, data) => fs.writeFileSync(p, data),
    mkdirSync: (p, opts) => {
      fs.mkdirSync(p, opts);
    },
  };
}

function isRecentProject(value: unknown): value is RecentProject {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.path === "string" &&
    typeof row.openedAt === "string"
  );
}

export function createRecentProjectService(
  options: RecentProjectServiceOptions,
) {
  const io = options.fs ?? defaultFs();
  const filePath = path.join(options.userDataPath, "recent-projects.json");
  const pathExists =
    options.pathExists ?? ((p: string) => io.existsSync(p));

  function readAll(): RecentProject[] {
    if (!io.existsSync(filePath)) return [];
    try {
      const raw = JSON.parse(io.readFileSync(filePath, "utf8")) as unknown;
      if (!Array.isArray(raw)) return [];
      return raw.filter(isRecentProject);
    } catch {
      return [];
    }
  }

  function writeAll(items: RecentProject[]): void {
    io.mkdirSync(options.userDataPath, { recursive: true });
    io.writeFileSync(filePath, `${JSON.stringify(items, null, 2)}\n`);
  }

  function list(): RecentProject[] {
    let items = readAll();
    if (options.pruneMissing) {
      items = items.filter((item) => pathExists(item.path));
    }
    return items;
  }

  function touch(input: {
    id: string;
    name: string;
    path: string;
    openedAt?: string;
  }): RecentProject[] {
    const openedAt = input.openedAt ?? new Date().toISOString();
    const next: RecentProject = {
      id: input.id,
      name: input.name,
      path: input.path,
      openedAt,
    };
    const others = readAll().filter(
      (item) => item.path !== next.path && item.id !== next.id,
    );
    const items = [next, ...others].slice(0, MAX_RECENT);
    writeAll(items);
    return items;
  }

  return { list, touch, filePath };
}

export type RecentProjectService = ReturnType<
  typeof createRecentProjectService
>;
