/**
 * Desktop export job orchestration (Phase 9 MVP).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrowserWindow, dialog, type SaveDialogOptions, type SaveDialogReturnValue } from "electron";
import type {
  CancelExportInput,
  ExportEvent,
  ExportJob,
  StartExportInput,
} from "../../shared/ipc/contracts";
import {
  DesktopIpcError,
  DesktopIpcErrorCode,
} from "../../shared/ipc/errors";
import {
  createExportProcessManager,
  type ExportProcessManager,
} from "../utility-processes/export-process-manager";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export type ExportServiceFs = {
  existsSync(p: string): boolean;
  mkdirSync(p: string, opts?: { recursive?: boolean }): void;
  writeFileSync(p: string, data: string): void;
  rmSync(p: string, opts?: { recursive?: boolean; force?: boolean }): void;
};

export type ShowSaveDialogFn = (
  browserWindow: BrowserWindow | undefined,
  options: SaveDialogOptions,
) => Promise<SaveDialogReturnValue>;

export type ExportServiceOptions = {
  fs?: ExportServiceFs;
  processManager?: ExportProcessManager;
  repoRoot: string;
  fixturesAssetBase?: string;
  timeoutMs?: number;
  createJobId?: () => string;
  showSaveDialog?: ShowSaveDialogFn;
  emit: (event: ExportEvent) => void;
};

function defaultFs(): ExportServiceFs {
  return {
    existsSync: fs.existsSync,
    mkdirSync: (p, opts) => {
      fs.mkdirSync(p, opts);
    },
    writeFileSync: (p, data) => {
      fs.writeFileSync(p, data, "utf8");
    },
    rmSync: (p, opts) => {
      fs.rmSync(p, opts);
    },
  };
}

function createJobId(): string {
  return `export_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type JobRecord = {
  sequence: number;
  tempDir: string;
  timeout: ReturnType<typeof setTimeout> | null;
  cancelled: boolean;
};

export function createExportService(options: ExportServiceOptions) {
  const io = options.fs ?? defaultFs();
  const manager = options.processManager ?? createExportProcessManager();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const uid = options.createJobId ?? createJobId;
  const showSaveDialog: ShowSaveDialogFn =
    options.showSaveDialog ??
    ((browserWindow, opts) =>
      browserWindow
        ? dialog.showSaveDialog(browserWindow, opts)
        : dialog.showSaveDialog(opts));
  const fixturesBase =
    options.fixturesAssetBase ??
    path.join(options.repoRoot, "docs", "fixtures", "v2");

  const jobs = new Map<string, JobRecord>();

  function nextSequence(jobId: string): number {
    const rec = jobs.get(jobId);
    if (!rec) return 0;
    rec.sequence += 1;
    return rec.sequence;
  }

  function emit(event: ExportEvent): void {
    options.emit(event);
  }

  function cleanupTemp(tempDir: string): void {
    try {
      io.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  function finishJob(jobId: string): void {
    const rec = jobs.get(jobId);
    if (!rec) return;
    if (rec.timeout) clearTimeout(rec.timeout);
    cleanupTemp(rec.tempDir);
    jobs.delete(jobId);
  }

  async function resolveOutputPath(
    input: StartExportInput,
    parent: BrowserWindow | null,
  ): Promise<string> {
    if (input.outputPath) {
      const resolved = path.resolve(input.outputPath);
      if (io.existsSync(resolved) && !input.overwrite) {
        throw new DesktopIpcError(
          DesktopIpcErrorCode.OUTPUT_DENIED,
          `Output already exists: ${resolved}`,
        );
      }
      return resolved;
    }

    const result = await showSaveDialog(parent ?? undefined, {
      title: "Export MP4",
      defaultPath: `${input.projectId}.mp4`,
      filters: [
        { name: "MP4 Video", extensions: ["mp4"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePath) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.CANCELLED,
        "Export cancelled.",
      );
    }
    const resolved = path.resolve(result.filePath);
    if (io.existsSync(resolved) && input.overwrite === false) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.OUTPUT_DENIED,
        `Output already exists: ${resolved}`,
      );
    }
    return resolved;
  }

  async function start(
    input: StartExportInput,
    parent: BrowserWindow | null,
  ): Promise<ExportJob> {
    let projectPayload: unknown;
    try {
      projectPayload = JSON.parse(input.projectJson) as unknown;
    } catch {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.VALIDATION,
        "projectJson is not valid JSON.",
      );
    }
    if (!projectPayload || typeof projectPayload !== "object") {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.VALIDATION,
        "projectJson must be a MotionProject object.",
      );
    }

    const outputPath = await resolveOutputPath(input, parent);
    const jobId = uid();
    const tempDir = path.join(os.tmpdir(), "moticlip-export", jobId);
    io.mkdirSync(tempDir, { recursive: true });
    const projectJsonPath = path.join(tempDir, "project.json");
    io.writeFileSync(projectJsonPath, JSON.stringify(projectPayload));

    const assetBaseDir = input.projectPath
      ? path.dirname(path.resolve(input.projectPath))
      : fixturesBase;

    const rec: JobRecord = {
      sequence: 0,
      tempDir,
      timeout: null,
      cancelled: false,
    };
    jobs.set(jobId, rec);

    emit({
      type: "progress",
      jobId,
      ratio: 0.05,
      sequence: nextSequence(jobId),
      message: "Starting export…",
    });

    rec.timeout = setTimeout(() => {
      const current = jobs.get(jobId);
      if (!current || current.cancelled) return;
      manager.cancel(jobId);
      emit({
        type: "failed",
        jobId,
        message: "Export timed out.",
        sequence: nextSequence(jobId),
      });
      finishJob(jobId);
    }, timeoutMs);

    void (async () => {
      try {
        emit({
          type: "progress",
          jobId,
          ratio: 0.2,
          sequence: nextSequence(jobId),
          message: "Rendering…",
        });

        const result = await manager.startJob({
          jobId,
          projectJsonPath,
          outDir: path.join(tempDir, "work"),
          assetBaseDir,
          outputPath,
          repoRoot: options.repoRoot,
          onStderrLine: (line) => {
            if (jobs.get(jobId)?.cancelled) return;
            if (!line.startsWith("progress\t")) return;
            const parts = line.split("\t");
            const stage = parts[1] ?? "working";
            const ratio = Number(parts[2]);
            if (!Number.isFinite(ratio)) return;
            emit({
              type: "progress",
              jobId,
              ratio: Math.min(0.95, Math.max(0.2, ratio)),
              sequence: nextSequence(jobId),
              message: stage,
            });
          },
        });

        const current = jobs.get(jobId);
        if (!current) return;
        if (current.cancelled || (!result.ok && result.error === "cancelled")) {
          emit({
            type: "cancelled",
            jobId,
            sequence: nextSequence(jobId),
          });
          finishJob(jobId);
          return;
        }

        if (!result.ok) {
          emit({
            type: "failed",
            jobId,
            message: result.error,
            sequence: nextSequence(jobId),
          });
          finishJob(jobId);
          return;
        }

        emit({
          type: "progress",
          jobId,
          ratio: 0.95,
          sequence: nextSequence(jobId),
          message: "Finishing…",
        });
        emit({
          type: "completed",
          jobId,
          outputPath: result.mp4Path,
          sequence: nextSequence(jobId),
        });
        finishJob(jobId);
      } catch (err) {
        if (!jobs.has(jobId)) return;
        emit({
          type: "failed",
          jobId,
          message: err instanceof Error ? err.message : String(err),
          sequence: nextSequence(jobId),
        });
        finishJob(jobId);
      }
    })();

    return { id: jobId };
  }

  function cancel(input: CancelExportInput): void {
    const rec = jobs.get(input.jobId);
    if (!rec) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.VALIDATION,
        `Unknown export job: ${input.jobId}`,
      );
    }
    rec.cancelled = true;
    manager.cancel(input.jobId);
    emit({
      type: "cancelled",
      jobId: input.jobId,
      sequence: nextSequence(input.jobId),
    });
    finishJob(input.jobId);
  }

  function dispose(): void {
    for (const [jobId, rec] of [...jobs.entries()]) {
      rec.cancelled = true;
      if (rec.timeout) clearTimeout(rec.timeout);
      manager.cancel(jobId);
      cleanupTemp(rec.tempDir);
    }
    jobs.clear();
    manager.disposeAll();
  }

  return { start, cancel, dispose };
}

export type ExportService = ReturnType<typeof createExportService>;
