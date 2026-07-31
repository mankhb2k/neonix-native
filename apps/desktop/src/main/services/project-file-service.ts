/**
 * Atomic project file IO for desktop main process.
 * Injectable fs for unit tests.
 */

import fs from "node:fs";
import path from "node:path";
import { BrowserWindow, dialog } from "electron";
import {
  DesktopIpcError,
  DesktopIpcErrorCode,
} from "../../shared/ipc/errors";
import type {
  ProjectOpenResult,
  SaveProjectResult,
} from "../../shared/ipc/contracts";
import {
  parseDesktopProjectFile,
  ProjectFileParseError,
  projectIdFromEnvelope,
  projectNameFromEnvelope,
  serializeDesktopProjectEnvelope,
  type DesktopProjectEnvelope,
} from "../../shared/project-file/envelope";

export type ProjectFileFs = {
  existsSync(p: string): boolean;
  readFileSync(p: string, encoding: BufferEncoding): string;
  writeFileSync(p: string, data: string | Buffer): void;
  copyFileSync(src: string, dest: string): void;
  renameSync(src: string, dest: string): void;
  unlinkSync(p: string): void;
  openSync(p: string, flags: string): number;
  fsyncSync(fd: number): void;
  closeSync(fd: number): void;
};

export type ProjectFileServiceOptions = {
  fs?: ProjectFileFs;
  /** Test hook: throw before rename to leave original intact. */
  beforeRename?: (tmpPath: string, finalPath: string) => void;
};

const MT_FILTERS = [
  { name: "MotionVideo Project", extensions: ["mt"] },
  { name: "All Files", extensions: ["*"] },
];

function mapParseError(error: unknown): never {
  if (error instanceof ProjectFileParseError) {
    throw new DesktopIpcError(
      error.code === "UNSUPPORTED_VERSION"
        ? DesktopIpcErrorCode.UNSUPPORTED_VERSION
        : DesktopIpcErrorCode.CORRUPT_FILE,
      error.message,
    );
  }
  throw error;
}

function defaultFs(): ProjectFileFs {
  return {
    existsSync: fs.existsSync,
    readFileSync: (p, encoding) => fs.readFileSync(p, encoding),
    writeFileSync: (p, data) => fs.writeFileSync(p, data),
    copyFileSync: fs.copyFileSync,
    renameSync: fs.renameSync,
    unlinkSync: fs.unlinkSync,
    openSync: (p, flags) => fs.openSync(p, flags),
    fsyncSync: fs.fsyncSync,
    closeSync: fs.closeSync,
  };
}

export function createProjectFileService(
  options: ProjectFileServiceOptions = {},
) {
  const io = options.fs ?? defaultFs();

  function readProject(filePath: string): {
    envelope: DesktopProjectEnvelope;
    documentJson: string;
    projectId: string;
    name: string;
  } {
    let text: string;
    try {
      text = io.readFileSync(filePath, "utf8");
    } catch (error) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.CORRUPT_FILE,
        error instanceof Error
          ? `Cannot read project file: ${error.message}`
          : "Cannot read project file.",
      );
    }
    try {
      const envelope = parseDesktopProjectFile(text);
      return {
        envelope,
        documentJson: serializeDesktopProjectEnvelope(envelope),
        projectId: projectIdFromEnvelope(envelope),
        name: projectNameFromEnvelope(envelope),
      };
    } catch (error) {
      mapParseError(error);
    }
  }

  function saveAtomic(
    filePath: string,
    documentJson: string,
  ): SaveProjectResult {
    // Validate before touching disk.
    try {
      parseDesktopProjectFile(documentJson);
    } catch (error) {
      mapParseError(error);
    }

    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const tmpPath = path.join(dir, `.${base}.${process.pid}.tmp`);
    const bakPath = `${filePath}.bak`;

    try {
      if (io.existsSync(filePath)) {
        io.copyFileSync(filePath, bakPath);
      }

      io.writeFileSync(tmpPath, documentJson);
      const fd = io.openSync(tmpPath, "r");
      try {
        try {
          io.fsyncSync(fd);
        } catch {
          /* Some platforms/temp dirs deny fsync; data is still on disk. */
        }
      } finally {
        io.closeSync(fd);
      }

      options.beforeRename?.(tmpPath, filePath);
      io.renameSync(tmpPath, filePath);
      return { path: filePath };
    } catch (error) {
      try {
        if (io.existsSync(tmpPath)) io.unlinkSync(tmpPath);
      } catch {
        /* ignore cleanup */
      }
      if (error instanceof DesktopIpcError) throw error;
      throw new DesktopIpcError(
        DesktopIpcErrorCode.SAVE_FAILED,
        error instanceof Error ? error.message : "Save failed.",
      );
    }
  }

  async function openViaDialog(
    parent?: BrowserWindow | null,
  ): Promise<ProjectOpenResult | null> {
    const opts = {
      title: "Open project",
      properties: ["openFile" as const],
      filters: MT_FILTERS,
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths[0]) {
      return null;
    }
    return openPath(result.filePaths[0]);
  }

  function openPath(filePath: string): ProjectOpenResult {
    const { documentJson, projectId } = readProject(filePath);
    return { path: filePath, projectId, documentJson };
  }

  async function saveAsViaDialog(
    documentJson: string,
    suggestedName?: string,
    parent?: BrowserWindow | null,
  ): Promise<SaveProjectResult> {
    try {
      parseDesktopProjectFile(documentJson);
    } catch (error) {
      mapParseError(error);
    }

    const defaultName = suggestedName?.endsWith(".mt")
      ? suggestedName
      : `${suggestedName ?? "Untitled"}.mt`;

    const result = parent
      ? await dialog.showSaveDialog(parent, {
          title: "Save project",
          defaultPath: defaultName,
          filters: MT_FILTERS,
        })
      : await dialog.showSaveDialog({
          title: "Save project",
          defaultPath: defaultName,
          filters: MT_FILTERS,
        });
    if (result.canceled || !result.filePath) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.CANCELLED,
        "Save As cancelled.",
      );
    }
    let target = result.filePath;
    if (!target.toLowerCase().endsWith(".mt")) {
      target = `${target}.mt`;
    }
    return saveAtomic(target, documentJson);
  }

  return {
    readProject,
    saveAtomic,
    openViaDialog,
    openPath,
    saveAsViaDialog,
  };
}

export type ProjectFileService = ReturnType<typeof createProjectFileService>;
