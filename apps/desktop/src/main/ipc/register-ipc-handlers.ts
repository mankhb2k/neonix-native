import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import type { ZodTypeAny } from "zod";
import {
  INVOKE_CHANNELS,
  IpcChannels,
  type IpcChannel,
} from "../../shared/ipc/channels";
import {
  DesktopIpcError,
  DesktopIpcErrorCode,
  serializeDesktopIpcError,
  type DesktopIpcErrorPayload,
} from "../../shared/ipc/errors";
import {
  cancelExportSchema,
  confirmCloseSchema,
  emptyPayloadSchema,
  importFilesSchema,
  listMissingAssetsSchema,
  openPathSchema,
  relinkAssetSchema,
  resolveAssetSchema,
  saveProjectAsSchema,
  saveProjectSchema,
  startExportSchema,
} from "../../shared/ipc/schemas";
import {
  buildBlankDesktopProject,
  parseDesktopProjectFile,
  projectIdFromEnvelope,
  projectNameFromEnvelope,
} from "../../shared/project-file/envelope";
import { getRendererMode } from "../../shared/renderer-mode";
import { createAssetFileService } from "../services/asset-file-service";
import { createExportService } from "../services/export-service";
import { createDisabledProjectJournal } from "../services/project-journal-service";
import { createProjectFileService } from "../services/project-file-service";
import { createRecentProjectService } from "../services/recent-project-service";
import { allowWindowClose } from "../windows/create-main-window";
import { validateSender } from "./validate-sender";
import path from "node:path";
import type { ExportEvent } from "../../shared/ipc/contracts";

export type RegisterIpcHandlersContext = {
  appVersion: string;
  packaged: boolean;
  userDataPath?: string;
};

export type RegisteredIpcHandlers = {
  dispose: () => void;
};

function notImplemented(feature: string): never {
  throw new DesktopIpcError(
    DesktopIpcErrorCode.NOT_IMPLEMENTED,
    `${feature} is not implemented yet (Phase 4/9).`,
  );
}

function parsePayload<T extends ZodTypeAny>(
  schema: T,
  payload: unknown,
): T["_output"] {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.VALIDATION,
      "Invalid IPC payload.",
      result.error.flatten(),
    );
  }
  return result.data;
}

function wrapHandler(
  handler: (event: IpcMainInvokeEvent, payload: unknown) => unknown | Promise<unknown>,
): (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown> {
  return async (event, payload) => {
    try {
      validateSender(event);
      return await handler(event, payload);
    } catch (error) {
      const desktopError =
        error instanceof DesktopIpcError
          ? error
          : new DesktopIpcError(
              DesktopIpcErrorCode.INTERNAL,
              error instanceof Error ? error.message : String(error),
            );
      const payload = serializeDesktopIpcError(desktopError);
      const err = new Error(payload.message) as Error & DesktopIpcErrorPayload;
      err.__desktopIpcError = true;
      err.code = payload.code;
      err.details = payload.details;
      throw err;
    }
  };
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerIpcHandlers(
  ctx: RegisterIpcHandlersContext,
): RegisteredIpcHandlers {
  const userDataPath = ctx.userDataPath;
  if (!userDataPath) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.INTERNAL,
      "userDataPath is required to register project handlers.",
    );
  }
  const projects = createProjectFileService();
  const assets = createAssetFileService();
  const recent = createRecentProjectService({
    userDataPath,
    pruneMissing: true,
  });
  const journal = createDisabledProjectJournal();

  // dist/main/ipc → apps/desktop/dist/main/ipc → repo root
  const repoRoot = path.resolve(__dirname, "../../../../..");

  function broadcastExportEvent(event: ExportEvent): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IpcChannels.exportEvent, event);
      }
    }
  }

  const exports = createExportService({
    repoRoot,
    emit: broadcastExportEvent,
  });

  function touchRecent(filePath: string, documentJson: string): void {
    try {
      const envelope = parseDesktopProjectFile(documentJson);
      recent.touch({
        id: projectIdFromEnvelope(envelope),
        name: projectNameFromEnvelope(envelope),
        path: filePath,
      });
      journal.record({
        type: "save",
        path: filePath,
        projectId: projectIdFromEnvelope(envelope),
        at: new Date().toISOString(),
      });
    } catch {
      /* recent is best-effort */
    }
  }

  const handlers: Array<
    [IpcChannel, (event: IpcMainInvokeEvent, payload: unknown) => unknown | Promise<unknown>]
  > = [
    [
      IpcChannels.appGetInfo,
      (_event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        return {
          platform: process.platform,
          version: ctx.appVersion,
          packaged: ctx.packaged,
          renderer: getRendererMode(),
        };
      },
    ],
    [
      IpcChannels.windowMinimize,
      (event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        BrowserWindow.fromWebContents(event.sender)?.minimize();
      },
    ],
    [
      IpcChannels.windowMaximize,
      (event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return false;
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
        return win.isMaximized();
      },
    ],
    [
      IpcChannels.windowClose,
      (event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        event.sender.send(IpcChannels.requestCloseSave);
      },
    ],
    [
      IpcChannels.windowIsMaximized,
      (event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
      },
    ],
    [
      IpcChannels.confirmClose,
      (event, payload) => {
        const normalized =
          typeof payload === "boolean" ? { ok: payload } : payload;
        const { ok } = parsePayload(confirmCloseSchema, normalized);
        if (!ok) return;
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;
        allowWindowClose(win.id);
        win.close();
      },
    ],
    [
      IpcChannels.projectNew,
      (_event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        const blank = buildBlankDesktopProject();
        journal.record({
          type: "new",
          projectId: blank.projectId,
          at: new Date().toISOString(),
        });
        return {
          projectId: blank.projectId,
          documentJson: blank.documentJson,
          name: blank.envelope.project.metadata.name,
        };
      },
    ],
    [
      IpcChannels.projectOpen,
      async (event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        const opened = await projects.openViaDialog(senderWindow(event));
        if (!opened) return null;
        const envelope = parseDesktopProjectFile(opened.documentJson);
        recent.touch({
          id: opened.projectId,
          name: projectNameFromEnvelope(envelope),
          path: opened.path,
        });
        journal.record({
          type: "open",
          path: opened.path,
          projectId: opened.projectId,
          at: new Date().toISOString(),
        });
        return opened;
      },
    ],
    [
      IpcChannels.projectOpenPath,
      (_event, payload) => {
        const { path: filePath } = parsePayload(openPathSchema, payload);
        const opened = projects.openPath(filePath);
        const envelope = parseDesktopProjectFile(opened.documentJson);
        recent.touch({
          id: opened.projectId,
          name: projectNameFromEnvelope(envelope),
          path: opened.path,
        });
        journal.record({
          type: "open",
          path: opened.path,
          projectId: opened.projectId,
          at: new Date().toISOString(),
        });
        return opened;
      },
    ],
    [
      IpcChannels.projectSave,
      async (event, payload) => {
        const input = parsePayload(saveProjectSchema, payload);
        if (!input.path) {
          const saved = await projects.saveAsViaDialog(
            input.documentJson,
            undefined,
            senderWindow(event),
          );
          touchRecent(saved.path, input.documentJson);
          return saved;
        }
        const saved = projects.saveAtomic(input.path, input.documentJson);
        touchRecent(saved.path, input.documentJson);
        return saved;
      },
    ],
    [
      IpcChannels.projectSaveAs,
      async (event, payload) => {
        const input = parsePayload(saveProjectAsSchema, payload);
        const saved = await projects.saveAsViaDialog(
          input.documentJson,
          input.suggestedName,
          senderWindow(event),
        );
        touchRecent(saved.path, input.documentJson);
        journal.record({
          type: "saveAs",
          path: saved.path,
          at: new Date().toISOString(),
        });
        return saved;
      },
    ],
    [
      IpcChannels.projectGetRecent,
      (_event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        return recent.list();
      },
    ],
    [
      IpcChannels.assetsImportFiles,
      async (event, payload) => {
        const input = parsePayload(importFilesSchema, payload);
        return assets.importFiles(
          input.projectPath,
          input.paths,
          senderWindow(event),
        );
      },
    ],
    [
      IpcChannels.assetsResolveUrl,
      (_event, payload) => {
        const input = parsePayload(resolveAssetSchema, payload);
        return assets.resolveUrl(
          input.projectPath,
          input.assetId,
          input.uri,
        );
      },
    ],
    [
      IpcChannels.assetsRelink,
      async (event, payload) => {
        const input = parsePayload(relinkAssetSchema, payload);
        return assets.relink(
          input.projectPath,
          input.assetId,
          input.newPath,
          senderWindow(event),
        );
      },
    ],
    [
      IpcChannels.assetsListMissing,
      (_event, payload) => {
        const input = parsePayload(listMissingAssetsSchema, payload);
        return assets.listMissing(input);
      },
    ],
    [
      IpcChannels.exportStart,
      async (event, payload) => {
        const input = parsePayload(startExportSchema, payload);
        return exports.start(input, senderWindow(event));
      },
    ],
    [
      IpcChannels.exportCancel,
      (_event, payload) => {
        const input = parsePayload(cancelExportSchema, payload);
        exports.cancel(input);
      },
    ],
  ];

  for (const [channel, handler] of handlers) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, wrapHandler(handler));
  }

  return {
    dispose: () => {
      exports.dispose();
      for (const channel of INVOKE_CHANNELS) {
        ipcMain.removeHandler(channel);
      }
    },
  };
}
