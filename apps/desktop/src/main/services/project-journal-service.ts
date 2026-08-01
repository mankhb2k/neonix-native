/**
 * Append-only crash-recovery journal + autosave snapshots under userData.
 * Cleared only after successful Save / Save As (or Discard recovery).
 *
 * All mutating ops share one queue. Save/Discard bump a per-key generation so
 * in-flight history/autosave writes become no-ops after clear.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { validateDesktopDocumentJson } from "../../shared/project-file/validate-document";

const META_FILE = "meta.json";
const ENTRIES_FILE = "entries.ndjson";
const SNAPSHOTS_DIR = "snapshots";
const DEFAULT_MAX_SNAPSHOTS = 3;
const JOURNAL_ROOT = "project-journals";

export type ProjectJournalEvent = {
  type: "open" | "save" | "saveAs" | "new";
  path?: string;
  projectId?: string;
  at: string;
};

/** History append — hash only (no full document over IPC). */
export type JournalHistoryInput = {
  projectId: string;
  path?: string;
  entryId: string;
  label: string;
  documentJsonHash: string;
};

export type JournalSnapshotInput = {
  projectId: string;
  path?: string;
  documentJson: string;
};

export type JournalLocator = {
  projectId?: string;
  path?: string;
};

export type JournalStatus = {
  enabled: boolean;
  dirty: boolean;
  projectId?: string;
  path?: string;
  lastSeq: number;
  hasRecoverableSnapshot: boolean;
  snapshotAt?: string;
  diskDocumentHash?: string;
  journalDocumentHash?: string;
};

export type JournalRecoveryOffer = {
  projectId?: string;
  path?: string;
  snapshotAt: string;
  journalDocumentHash: string;
  diskDocumentHash?: string;
};

export type JournalWriteResult = {
  seq: number;
};

export type ProjectJournalService = {
  enabled: boolean;
  record(event: ProjectJournalEvent): Promise<void>;
  bind(input: {
    projectId: string;
    path?: string;
    documentJson?: string;
  }): Promise<void>;
  recordHistory(input: JournalHistoryInput): Promise<JournalWriteResult>;
  writeAutosaveSnapshot(input: JournalSnapshotInput): Promise<JournalWriteResult>;
  status(locator: JournalLocator): JournalStatus;
  peekRecovery(input: {
    projectId?: string;
    path?: string;
    documentJson?: string;
  }): JournalRecoveryOffer | null;
  recover(
    locator: JournalLocator,
  ): Promise<{ documentJson: string; projectId?: string } | null>;
  discard(locator: JournalLocator): Promise<void>;
  clear(locator: JournalLocator): Promise<void>;
  /** Clear both path-keyed and projectId-keyed journals. */
  clearBoth(locator: JournalLocator): Promise<void>;
  migrateJournal(input: {
    from: { projectId: string };
    to: { path: string; projectId: string };
  }): Promise<void>;
  flush(): Promise<void>;
};

export type ProjectJournalFs = {
  existsSync(p: string): boolean;
  mkdirSync(p: string, opts?: { recursive?: boolean }): void;
  readFileSync(p: string, encoding: BufferEncoding): string;
  writeFileSync(p: string, data: string): void;
  appendFileSync(p: string, data: string): void;
  readdirSync(p: string): string[];
  unlinkSync(p: string): void;
  rmSync(p: string, opts?: { recursive?: boolean; force?: boolean }): void;
  renameSync?(from: string, to: string): void;
  /** Optional async overrides (production default uses fs.promises). */
  writeFile?(p: string, data: string): Promise<void>;
  appendFile?(p: string, data: string): Promise<void>;
  rename?(from: string, to: string): Promise<void>;
  fsyncPath?(p: string): Promise<void>;
  rm?(p: string, opts?: { recursive?: boolean; force?: boolean }): Promise<void>;
};

export type ProjectJournalServiceOptions = {
  userDataPath: string;
  enabled?: boolean;
  maxSnapshots?: number;
  fs?: ProjectJournalFs;
  now?: () => Date;
  beforeSnapshotCommit?: (tmpPath: string, finalPath: string) => void;
};

type JournalMeta = {
  projectId?: string;
  path?: string;
  dirty: boolean;
  lastSeq: number;
  diskDocumentHash?: string;
  journalDocumentHash?: string;
  snapshotAt?: string;
  snapshotFile?: string;
  corrupt?: boolean;
  updatedAt: string;
};

function defaultFs(): ProjectJournalFs {
  return {
    existsSync: fs.existsSync,
    mkdirSync: (p, opts) => {
      fs.mkdirSync(p, opts);
    },
    readFileSync: (p, encoding) => fs.readFileSync(p, encoding),
    writeFileSync: (p, data) => fs.writeFileSync(p, data),
    appendFileSync: (p, data) => fs.appendFileSync(p, data),
    readdirSync: (p) => fs.readdirSync(p),
    unlinkSync: (p) => fs.unlinkSync(p),
    rmSync: (p, opts) => fs.rmSync(p, opts),
    renameSync: (from, to) => fs.renameSync(from, to),
    writeFile: (p, data) => fsp.writeFile(p, data, "utf8"),
    appendFile: (p, data) => fsp.appendFile(p, data, "utf8"),
    rename: (from, to) => fsp.rename(from, to),
    fsyncPath: async (p) => {
      const handle = await fsp.open(p, "r+");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    },
    rm: (p, opts) => fsp.rm(p, opts),
  };
}

export function hashDocumentJson(documentJson: string): string {
  return createHash("sha256").update(documentJson).digest("hex");
}

/** Path key wins when both present — use clearBoth for save/discard. */
export function journalKeyFor(locator: JournalLocator): string | null {
  if (locator.path) {
    const normalized = path.normalize(locator.path);
    return createHash("sha256").update(`path:${normalized}`).digest("hex").slice(0, 24);
  }
  if (locator.projectId) {
    return createHash("sha256")
      .update(`id:${locator.projectId}`)
      .digest("hex")
      .slice(0, 24);
  }
  return null;
}

function isValidDocumentJson(documentJson: string): boolean {
  try {
    validateDesktopDocumentJson(documentJson);
    return true;
  } catch {
    return false;
  }
}

export function createDisabledProjectJournal(): ProjectJournalService {
  return {
    enabled: false,
    async record() {},
    async bind() {},
    async recordHistory() {
      return { seq: 0 };
    },
    async writeAutosaveSnapshot() {
      return { seq: 0 };
    },
    status() {
      return {
        enabled: false,
        dirty: false,
        lastSeq: 0,
        hasRecoverableSnapshot: false,
      };
    },
    peekRecovery() {
      return null;
    },
    async recover() {
      return null;
    },
    async discard() {},
    async clear() {},
    async clearBoth() {},
    async migrateJournal() {},
    async flush() {},
  };
}

export function createProjectJournalService(
  options: ProjectJournalServiceOptions,
): ProjectJournalService {
  const enabled = options.enabled ?? true;
  if (!enabled) return createDisabledProjectJournal();

  const io = options.fs ?? defaultFs();
  const maxSnapshots = Math.max(1, options.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS);
  const now = options.now ?? (() => new Date());
  const root = path.join(options.userDataPath, JOURNAL_ROOT);
  const beforeSnapshotCommit = options.beforeSnapshotCommit;

  let queue: Promise<void> = Promise.resolve();
  /** Per journal-key generation; bumped on save/discard so stale writes no-op. */
  const generations = new Map<string, number>();

  function enqueue<T>(task: () => T | Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function genOf(key: string): number {
    return generations.get(key) ?? 0;
  }

  function bumpKeys(locator: JournalLocator): void {
    if (locator.path) {
      const k = journalKeyFor({ path: locator.path });
      if (k) generations.set(k, genOf(k) + 1);
    }
    if (locator.projectId) {
      const k = journalKeyFor({ projectId: locator.projectId });
      if (k) generations.set(k, genOf(k) + 1);
    }
  }

  function dirForPath(filePath: string): string {
    return path.join(root, journalKeyFor({ path: filePath })!);
  }

  function dirForProjectId(projectId: string): string {
    return path.join(root, journalKeyFor({ projectId })!);
  }

  function dirFor(locator: JournalLocator): string | null {
    const key = journalKeyFor(locator);
    if (!key) return null;
    return path.join(root, key);
  }

  function metaPath(dir: string): string {
    return path.join(dir, META_FILE);
  }

  function entriesPath(dir: string): string {
    return path.join(dir, ENTRIES_FILE);
  }

  function snapshotsDir(dir: string): string {
    return path.join(dir, SNAPSHOTS_DIR);
  }

  function ensureDirSync(dir: string): void {
    io.mkdirSync(dir, { recursive: true });
    io.mkdirSync(snapshotsDir(dir), { recursive: true });
  }

  async function writeFile(p: string, data: string): Promise<void> {
    if (io.writeFile) await io.writeFile(p, data);
    else io.writeFileSync(p, data);
  }

  async function appendFile(p: string, data: string): Promise<void> {
    if (io.appendFile) await io.appendFile(p, data);
    else io.appendFileSync(p, data);
  }

  async function rename(from: string, to: string): Promise<void> {
    if (io.rename) await io.rename(from, to);
    else if (io.renameSync) io.renameSync(from, to);
    else {
      await writeFile(to, io.readFileSync(from, "utf8"));
      io.unlinkSync(from);
    }
  }

  async function fsyncPath(p: string): Promise<void> {
    if (io.fsyncPath) await io.fsyncPath(p);
  }

  async function removeDir(dir: string): Promise<void> {
    if (!io.existsSync(dir)) return;
    try {
      if (io.rm) await io.rm(dir, { recursive: true, force: true });
      else io.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }

  function readMeta(dir: string): JournalMeta | null {
    const file = metaPath(dir);
    if (!io.existsSync(file)) return null;
    try {
      const raw = JSON.parse(io.readFileSync(file, "utf8")) as unknown;
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      return {
        projectId: typeof row.projectId === "string" ? row.projectId : undefined,
        path: typeof row.path === "string" ? row.path : undefined,
        dirty: row.dirty === true,
        lastSeq: typeof row.lastSeq === "number" ? row.lastSeq : 0,
        diskDocumentHash:
          typeof row.diskDocumentHash === "string"
            ? row.diskDocumentHash
            : undefined,
        journalDocumentHash:
          typeof row.journalDocumentHash === "string"
            ? row.journalDocumentHash
            : undefined,
        snapshotAt:
          typeof row.snapshotAt === "string" ? row.snapshotAt : undefined,
        snapshotFile:
          typeof row.snapshotFile === "string" ? row.snapshotFile : undefined,
        corrupt: row.corrupt === true,
        updatedAt:
          typeof row.updatedAt === "string"
            ? row.updatedAt
            : now().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async function writeMetaAtomic(dir: string, meta: JournalMeta): Promise<void> {
    ensureDirSync(dir);
    const finalPath = metaPath(dir);
    const tmp = `${finalPath}.${process.pid}.tmp`;
    const body = `${JSON.stringify(meta, null, 2)}\n`;
    await writeFile(tmp, body);
    try {
      await fsyncPath(tmp);
    } catch {
      /* fsync best-effort on platforms/fs mocks */
    }
    await rename(tmp, finalPath);
  }

  function listSnapshotFiles(dir: string): string[] {
    const snapDir = snapshotsDir(dir);
    if (!io.existsSync(snapDir)) return [];
    return io
      .readdirSync(snapDir)
      .filter((name) => name.startsWith("snapshot-") && name.endsWith(".json"))
      .sort();
  }

  function rotateSnapshotsSync(dir: string): void {
    const files = listSnapshotFiles(dir);
    while (files.length > maxSnapshots) {
      const oldest = files.shift();
      if (!oldest) break;
      try {
        io.unlinkSync(path.join(snapshotsDir(dir), oldest));
      } catch {
        /* ignore */
      }
    }
  }

  async function clearBothImpl(locator: JournalLocator): Promise<void> {
    bumpKeys(locator);
    if (locator.path) {
      await removeDir(dirForPath(locator.path));
    }
    if (locator.projectId) {
      await removeDir(dirForProjectId(locator.projectId));
    }
  }

  async function quarantineCorrupt(dir: string, meta: JournalMeta | null): Promise<void> {
    const next: JournalMeta = {
      projectId: meta?.projectId,
      path: meta?.path,
      dirty: false,
      lastSeq: meta?.lastSeq ?? 0,
      diskDocumentHash: meta?.diskDocumentHash,
      journalDocumentHash: undefined,
      snapshotAt: undefined,
      snapshotFile: undefined,
      corrupt: true,
      updatedAt: now().toISOString(),
    };
    try {
      await writeMetaAtomic(dir, next);
    } catch {
      await removeDir(dir);
    }
  }

  function snapshotIsValid(dir: string, meta: JournalMeta): boolean {
    if (!meta.snapshotFile || meta.corrupt) return false;
    const snapPath = path.join(snapshotsDir(dir), meta.snapshotFile);
    if (!io.existsSync(snapPath)) return false;
    try {
      const documentJson = io.readFileSync(snapPath, "utf8");
      return isValidDocumentJson(documentJson);
    } catch {
      return false;
    }
  }

  async function bind(input: {
    projectId: string;
    path?: string;
    documentJson?: string;
  }): Promise<void> {
    return enqueue(async () => {
      const dir = dirFor(input);
      if (!dir) return;
      const diskHash = input.documentJson
        ? hashDocumentJson(input.documentJson)
        : undefined;
      const existing = readMeta(dir);
      const snapOk =
        Boolean(existing?.dirty) &&
        Boolean(existing?.snapshotFile) &&
        !existing?.corrupt &&
        snapshotIsValid(dir, existing!);
      if (existing && snapOk) {
        await writeMetaAtomic(dir, {
          ...existing,
          projectId: input.projectId,
          path: input.path ?? existing.path,
          diskDocumentHash: diskHash ?? existing.diskDocumentHash,
          updatedAt: now().toISOString(),
        });
        return;
      }
      await writeMetaAtomic(dir, {
        projectId: input.projectId,
        path: input.path,
        dirty: false,
        lastSeq: 0,
        diskDocumentHash: diskHash,
        journalDocumentHash: diskHash,
        snapshotAt: undefined,
        snapshotFile: undefined,
        corrupt: false,
        updatedAt: now().toISOString(),
      });
    });
  }

  function status(locator: JournalLocator): JournalStatus {
    const dir = dirFor(locator);
    if (!dir) {
      return {
        enabled: true,
        dirty: false,
        lastSeq: 0,
        hasRecoverableSnapshot: false,
      };
    }
    const meta = readMeta(dir);
    if (!meta || meta.corrupt) {
      return {
        enabled: true,
        dirty: false,
        lastSeq: meta?.lastSeq ?? 0,
        hasRecoverableSnapshot: false,
      };
    }
    const hasSnap =
      Boolean(meta.snapshotFile) &&
      io.existsSync(path.join(snapshotsDir(dir), meta.snapshotFile!));
    return {
      enabled: true,
      dirty: meta.dirty,
      projectId: meta.projectId,
      path: meta.path,
      lastSeq: meta.lastSeq,
      hasRecoverableSnapshot: meta.dirty && hasSnap,
      snapshotAt: meta.snapshotAt,
      diskDocumentHash: meta.diskDocumentHash,
      journalDocumentHash: meta.journalDocumentHash,
    };
  }

  function peekRecovery(input: {
    projectId?: string;
    path?: string;
    documentJson?: string;
  }): JournalRecoveryOffer | null {
    const candidates: JournalLocator[] = [];
    if (input.path) candidates.push({ path: input.path });
    if (input.projectId) candidates.push({ projectId: input.projectId });

    for (const loc of candidates) {
      const dir = dirFor(loc);
      if (!dir) continue;
      const meta = readMeta(dir);
      if (!meta?.dirty || !meta.snapshotFile || !meta.snapshotAt || meta.corrupt) {
        continue;
      }
      const snapPath = path.join(snapshotsDir(dir), meta.snapshotFile);
      if (!io.existsSync(snapPath)) continue;

      let documentJson: string;
      try {
        documentJson = io.readFileSync(snapPath, "utf8");
      } catch {
        continue;
      }
      if (!isValidDocumentJson(documentJson)) {
        void enqueue(() => quarantineCorrupt(dir, meta));
        continue;
      }

      const diskHash = input.documentJson
        ? hashDocumentJson(input.documentJson)
        : meta.diskDocumentHash;
      const journalHash = meta.journalDocumentHash ?? hashDocumentJson(documentJson);
      if (diskHash && diskHash === journalHash) continue;

      return {
        projectId: meta.projectId ?? input.projectId,
        path: meta.path ?? input.path,
        snapshotAt: meta.snapshotAt,
        journalDocumentHash: journalHash,
        diskDocumentHash: diskHash,
      };
    }
    return null;
  }

  async function recover(
    locator: JournalLocator,
  ): Promise<{ documentJson: string; projectId?: string } | null> {
    return enqueue(async () => {
      const candidates: JournalLocator[] = [];
      if (locator.path) candidates.push({ path: locator.path });
      if (locator.projectId) candidates.push({ projectId: locator.projectId });

      for (const loc of candidates) {
        const dir = dirFor(loc);
        if (!dir) continue;
        const meta = readMeta(dir);
        if (!meta?.snapshotFile || meta.corrupt) continue;
        const snapPath = path.join(snapshotsDir(dir), meta.snapshotFile);
        if (!io.existsSync(snapPath)) continue;
        try {
          const documentJson = io.readFileSync(snapPath, "utf8");
          if (!isValidDocumentJson(documentJson)) {
            await quarantineCorrupt(dir, meta);
            continue;
          }
          await writeMetaAtomic(dir, {
            ...meta,
            dirty: true,
            corrupt: false,
            journalDocumentHash: hashDocumentJson(documentJson),
            updatedAt: now().toISOString(),
          });
          return { documentJson, projectId: meta.projectId };
        } catch {
          continue;
        }
      }
      return null;
    });
  }

  async function record(event: ProjectJournalEvent): Promise<void> {
    if (event.type === "save" || event.type === "saveAs") {
      await enqueue(async () => {
        await clearBothImpl({ path: event.path, projectId: event.projectId });
      });
      return;
    }
    if (event.type === "new" && event.projectId) {
      await enqueue(async () => {
        await clearBothImpl({ projectId: event.projectId });
        const dir = dirForProjectId(event.projectId!);
        await writeMetaAtomic(dir, {
          projectId: event.projectId,
          dirty: false,
          lastSeq: 0,
          updatedAt: now().toISOString(),
        });
      });
    }
  }

  async function recordHistory(
    input: JournalHistoryInput,
  ): Promise<JournalWriteResult> {
    const key = journalKeyFor(input);
    if (!key) throw new Error("Journal locator missing projectId/path.");
    const genCaptured = genOf(key);
    return enqueue(async () => {
      if (genOf(key) !== genCaptured) {
        return { seq: 0 };
      }
      const dir = dirFor(input);
      if (!dir) throw new Error("Journal locator missing projectId/path.");
      if (!input.documentJsonHash?.trim()) {
        throw new Error("documentJsonHash is required.");
      }
      ensureDirSync(dir);
      if (genOf(key) !== genCaptured) {
        return { seq: 0 };
      }
      const meta = readMeta(dir) ?? {
        projectId: input.projectId,
        path: input.path,
        dirty: false,
        lastSeq: 0,
        updatedAt: now().toISOString(),
      };
      const seq = meta.lastSeq + 1;
      const line = JSON.stringify({
        seq,
        at: now().toISOString(),
        entryId: input.entryId,
        label: input.label,
        documentJsonHash: input.documentJsonHash,
      });
      await appendFile(entriesPath(dir), `${line}\n`);
      if (genOf(key) !== genCaptured) {
        return { seq: 0 };
      }
      await writeMetaAtomic(dir, {
        ...meta,
        projectId: input.projectId,
        path: input.path ?? meta.path,
        dirty: true,
        corrupt: false,
        lastSeq: seq,
        journalDocumentHash: input.documentJsonHash,
        updatedAt: now().toISOString(),
      });
      if (genOf(key) !== genCaptured) {
        // Save/discard won the race after we wrote — clear again.
        await clearBothImpl({ path: input.path, projectId: input.projectId });
        return { seq: 0 };
      }
      return { seq };
    });
  }

  async function writeAutosaveSnapshot(
    input: JournalSnapshotInput,
  ): Promise<JournalWriteResult> {
    if (!isValidDocumentJson(input.documentJson)) {
      throw new Error("Autosave documentJson failed validation.");
    }
    const key = journalKeyFor(input);
    if (!key) throw new Error("Journal locator missing projectId/path.");
    const genCaptured = genOf(key);
    return enqueue(async () => {
      if (genOf(key) !== genCaptured) {
        return { seq: 0 };
      }
      const dir = dirFor(input);
      if (!dir) throw new Error("Journal locator missing projectId/path.");
      ensureDirSync(dir);
      const meta = readMeta(dir) ?? {
        projectId: input.projectId,
        path: input.path,
        dirty: false,
        lastSeq: 0,
        updatedAt: now().toISOString(),
      };
      const seq = meta.lastSeq + 1;
      const name = `snapshot-${String(seq).padStart(6, "0")}.json`;
      const snapPath = path.join(snapshotsDir(dir), name);
      const tmp = path.join(
        snapshotsDir(dir),
        `.snapshot-${String(seq).padStart(6, "0")}.${process.pid}.tmp`,
      );
      try {
        await writeFile(tmp, input.documentJson);
        beforeSnapshotCommit?.(tmp, snapPath);
        if (genOf(key) !== genCaptured) {
          try {
            io.unlinkSync(tmp);
          } catch {
            /* ignore */
          }
          return { seq: 0 };
        }
        await rename(tmp, snapPath);
      } catch (error) {
        try {
          if (io.existsSync(tmp)) io.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        throw error instanceof Error
          ? error
          : new Error("Autosave snapshot write failed.");
      }
      rotateSnapshotsSync(dir);
      if (genOf(key) !== genCaptured) {
        await clearBothImpl({ path: input.path, projectId: input.projectId });
        return { seq: 0 };
      }
      const documentJsonHash = hashDocumentJson(input.documentJson);
      await writeMetaAtomic(dir, {
        ...meta,
        projectId: input.projectId,
        path: input.path ?? meta.path,
        dirty: true,
        corrupt: false,
        lastSeq: seq,
        journalDocumentHash: documentJsonHash,
        snapshotAt: now().toISOString(),
        snapshotFile: name,
        updatedAt: now().toISOString(),
      });
      if (genOf(key) !== genCaptured) {
        await clearBothImpl({ path: input.path, projectId: input.projectId });
        return { seq: 0 };
      }
      return { seq };
    });
  }

  async function discard(locator: JournalLocator): Promise<void> {
    return enqueue(async () => {
      await clearBothImpl(locator);
    });
  }

  async function clear(locator: JournalLocator): Promise<void> {
    return enqueue(async () => {
      bumpKeys(locator);
      const dir = dirFor(locator);
      if (dir) await removeDir(dir);
    });
  }

  async function clearBoth(locator: JournalLocator): Promise<void> {
    return enqueue(async () => {
      await clearBothImpl(locator);
    });
  }

  async function migrateJournal(input: {
    from: { projectId: string };
    to: { path: string; projectId: string };
  }): Promise<void> {
    return enqueue(async () => {
      const fromDir = dirForProjectId(input.from.projectId);
      const toDir = dirForPath(input.to.path);
      bumpKeys({ projectId: input.from.projectId, path: input.to.path });
      if (io.existsSync(fromDir) && fromDir !== toDir) {
        if (io.existsSync(toDir)) {
          await removeDir(toDir);
        }
        try {
          io.mkdirSync(root, { recursive: true });
          await rename(fromDir, toDir);
        } catch {
          await removeDir(fromDir);
        }
        const meta = readMeta(toDir);
        if (meta) {
          await writeMetaAtomic(toDir, {
            ...meta,
            projectId: input.to.projectId,
            path: input.to.path,
            updatedAt: now().toISOString(),
          });
        }
      }
      await removeDir(dirForProjectId(input.from.projectId));
    });
  }

  return {
    enabled: true,
    record,
    bind,
    recordHistory,
    writeAutosaveSnapshot,
    status,
    peekRecovery,
    recover,
    discard,
    clear,
    clearBoth,
    migrateJournal,
    flush: () => queue,
  };
}
