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
} from "../../shared/ipc/errors";
import {
  cancelExportSchema,
  confirmCloseSchema,
  emptyPayloadSchema,
  importFilesSchema,
  listMissingAssetsSchema,
  openRecentSchema,
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
import {
  clearProjectSession,
  getProjectSession,
  requireProjectSession,
  setProjectSession,
} from "../services/project-session";
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
      const value = await handler(event, payload);
      return { ok: true as const, value };
    } catch (error) {
      const desktopError =
        error instanceof DesktopIpcError
          ? error
          : new DesktopIpcError(
              DesktopIpcErrorCode.INTERNAL,
              error instanceof Error ? error.message : String(error),
            );
      return {
        ok: false as const,
        error: serializeDesktopIpcError(desktopError),
      };
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
    packaged: ctx.packaged,
    resourcesRoot: ctx.packaged ? process.resourcesPath : undefined,
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
      (event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        clearProjectSession(event.sender.id);
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
        setProjectSession(event.sender.id, {
          path: opened.path,
          projectId: opened.projectId,
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
      IpcChannels.projectOpenRecent,
      (_event, payload) => {
        const { id } = parsePayload(openRecentSchema, payload);
        const entry = recent.list().find((item) => item.id === id);
        if (!entry) {
          throw new DesktopIpcError(
            DesktopIpcErrorCode.VALIDATION,
            "Recent project not found.",
          );
        }
        const opened = projects.openPath(entry.path);
        const envelope = parseDesktopProjectFile(opened.documentJson);
        recent.touch({
          id: opened.projectId,
          name: projectNameFromEnvelope(envelope),
          path: opened.path,
        });
        setProjectSession(_event.sender.id, {
          path: opened.path,
          projectId: opened.projectId,
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
        const session = getProjectSession(event.sender.id);
        if (!session) {
          const saved = await projects.saveAsViaDialog(
            input.documentJson,
            undefined,
            senderWindow(event),
          );
          touchRecent(saved.path, input.documentJson);
          const envelope = parseDesktopProjectFile(input.documentJson);
          setProjectSession(event.sender.id, {
            path: saved.path,
            projectId: projectIdFromEnvelope(envelope),
          });
          return saved;
        }
        const saved = await projects.saveAtomic(session.path, input.documentJson);
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
        const envelope = parseDesktopProjectFile(input.documentJson);
        setProjectSession(event.sender.id, {
          path: saved.path,
          projectId: projectIdFromEnvelope(envelope),
        });
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
        parsePayload(importFilesSchema, payload);
        const session = requireProjectSession(event.sender.id);
        return assets.importFiles(
          session.path,
          undefined,
          senderWindow(event),
        );
      },
    ],
    [
      IpcChannels.assetsResolveUrl,
      (event, payload) => {
        const input = parsePayload(resolveAssetSchema, payload);
        const session = requireProjectSession(event.sender.id);
        return assets.resolveUrl(
          session.path,
          input.assetId,
          input.uri,
        );
      },
    ],
    [
      IpcChannels.assetsRelink,
      async (event, payload) => {
        const input = parsePayload(relinkAssetSchema, payload);
        const session = requireProjectSession(event.sender.id);
        return assets.relink(
          session.path,
          input.assetId,
          undefined,
          senderWindow(event),
        );
      },
    ],
    [
      IpcChannels.assetsListMissing,
      (event, payload) => {
        const input = parsePayload(listMissingAssetsSchema, payload);
        const session = requireProjectSession(event.sender.id);
        return assets.listMissing({
          projectPath: session.path,
          assets: input.assets,
        });
      },
    ],
    [
      IpcChannels.exportStart,
      async (event, payload) => {
        const input = parsePayload(startExportSchema, payload);
        const session = getProjectSession(event.sender.id);
        return exports.start(
          {
            projectId: input.projectId,
            projectJson: input.projectJson,
            overwrite: input.overwrite,
            presetId: input.presetId,
            projectPath: session?.path,
            // Output always via dialog — never trust renderer absolute paths.
            outputPath: undefined,
          },
          senderWindow(event),
        );
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
