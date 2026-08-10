import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  INVOKE_CHANNELS,
  IpcChannels,
  type IpcChannel,
} from "../../../shared/ipc/channels";
import {
  DesktopIpcError,
  DesktopIpcErrorCode,
  serializeDesktopIpcError,
} from "../../../shared/ipc/errors";
import {
  cancelExportSchema,
  confirmCloseSchema,
  createProjectSchema,
  emptyPayloadSchema,
  importFilesSchema,
  journalAutosaveSchema,
  journalLocatorSchema,
  journalRecordSchema,
  listMissingAssetsSchema,
  openRecentSchema,
  relinkAssetSchema,
  resolveAssetSchema,
  saveProjectAsSchema,
  saveProjectSchema,
  startExportSchema,
} from "../../../shared/ipc/schemas";
import {
  buildBlankDesktopProject,
  envelopeAspectRatio,
  parseDesktopProjectFile,
  projectIdFromEnvelope,
  projectNameFromEnvelope,
  serializeDesktopProjectEnvelope,
} from "../../../shared/project-file/envelope";
import { seedDemoSidebarAssets } from "../../../shared/project-file/seed-demo-sidebar";
import { getRendererMode } from "../../../shared/renderer-mode";
import { createAssetFileService } from "../services/asset-file/asset-file.service";
import { createExportService } from "../services/export/export.service";
import { createProjectFileService } from "../services/project-file/project-file.service";
import { createProjectJournalService } from "../services/project-journal/project-journal.service";
import {
  assertDocumentMatchesSession,
  assertSessionProjectId,
  getProjectSession,
  requireSavedProjectSession,
  setProjectSession,
} from "../services/project-journal/project.session";
import { createRecentProjectService } from "../services/recent-project/recent-project.service";
import { allowWindowClose } from "../windows/create-main-window";
import { validateSender } from "./validate-sender";
import type { ExportEvent, ProjectOpenResult } from "../../../shared/ipc/contracts";
import type { ZodTypeAny } from "zod";

export type RegisterIpcHandlersContext = {
  appVersion: string;
  packaged: boolean;
  userDataPath?: string;
  /** Injected DesktopPaths — never infer from __dirname. */
  repoRoot: string;
  resourcesRoot?: string;
};

export type RegisteredIpcHandlers = {
  dispose: () => void;
};

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
  const journal = createProjectJournalService({
    userDataPath,
    enabled: process.env.VITE_ENABLE_UI_FIXTURES !== "1",
  });

  const repoRoot = ctx.repoRoot;
  const resourcesRoot =
    ctx.resourcesRoot ?? (ctx.packaged ? process.resourcesPath : undefined);

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
    resourcesRoot,
    emit: broadcastExportEvent,
  });

  async function touchRecent(
    filePath: string,
    documentJson: string,
  ): Promise<void> {
    try {
      const envelope = parseDesktopProjectFile(documentJson);
      recent.touch({
        id: projectIdFromEnvelope(envelope),
        name: projectNameFromEnvelope(envelope),
        path: filePath,
        aspectRatio: envelopeAspectRatio(envelope),
      });
      await journal.record({
        type: "save",
        path: filePath,
        projectId: projectIdFromEnvelope(envelope),
        at: new Date().toISOString(),
      });
    } catch {
      /* recent is best-effort */
    }
  }

  async function applyJournalOnOpen(
    opened: ProjectOpenResult,
    parent: BrowserWindow | null,
  ): Promise<ProjectOpenResult> {
    const offer = journal.peekRecovery({
      path: opened.path,
      projectId: opened.projectId,
      documentJson: opened.documentJson,
    });
    if (!offer) {
      await journal.bind({
        projectId: opened.projectId,
        path: opened.path,
        documentJson: opened.documentJson,
      });
      return opened;
    }

    const boxOpts = {
      type: "warning" as const,
      buttons: ["Recover", "Discard"],
      defaultId: 0,
      cancelId: 1,
      title: "Recover unsaved work?",
      message: "A newer autosave was found for this project.",
      detail:
        "Recover loads the last autosave snapshot. Discard keeps the file on disk and clears the recovery journal.",
    };
    const { response } = parent
      ? await dialog.showMessageBox(parent, boxOpts)
      : await dialog.showMessageBox(boxOpts);

    if (response === 0) {
      const recovered = await journal.recover({
        path: opened.path,
        projectId: opened.projectId,
      });
      if (recovered?.documentJson) {
        return {
          ...opened,
          documentJson: recovered.documentJson,
          recoveredFromJournal: true,
        };
      }
    }

    await journal.discard({ path: opened.path, projectId: opened.projectId });
    await journal.bind({
      projectId: opened.projectId,
      path: opened.path,
      documentJson: opened.documentJson,
    });
    return opened;
  }

  function journalLocatorFromEvent(
    event: IpcMainInvokeEvent,
    projectId?: string,
  ): { projectId?: string; path?: string } {
    const session = getProjectSession(event.sender.id);
    assertSessionProjectId(session, projectId);
    return {
      path: session?.path ?? undefined,
      projectId: session?.projectId ?? projectId,
    };
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
      async (event, payload) => {
        const input = parsePayload(createProjectSchema, payload) ?? {};
        const blank = buildBlankDesktopProject({
          name: input.name,
          aspectRatio: input.aspectRatio,
        });
        // Dev/unpackaged: seed Audio panel catalog (no timeline clips).
        const envelope = app.isPackaged
          ? blank.envelope
          : seedDemoSidebarAssets(blank.envelope, (prefix) => {
              const stamp = Date.now().toString(36);
              const rand = Math.random().toString(36).slice(2, 7);
              return `${prefix}_${stamp}_${rand}`;
            });
        const documentJson = serializeDesktopProjectEnvelope(envelope);
        setProjectSession(event.sender.id, {
          path: null,
          projectId: blank.projectId,
        });
        await journal.record({
          type: "new",
          projectId: blank.projectId,
          at: new Date().toISOString(),
        });
        return {
          projectId: blank.projectId,
          documentJson,
          name: envelope.project.metadata.name,
          aspectRatio: envelopeAspectRatio(envelope),
        };
      },
    ],
    [
      IpcChannels.projectOpen,
      async (event, payload) => {
        parsePayload(emptyPayloadSchema, payload);
        const opened = await projects.openViaDialog(senderWindow(event));
        if (!opened) return null;
        const recovered = await applyJournalOnOpen(
          opened,
          senderWindow(event),
        );
        const envelope = parseDesktopProjectFile(recovered.documentJson);
        recent.touch({
          id: recovered.projectId,
          name: projectNameFromEnvelope(envelope),
          path: recovered.path,
          aspectRatio: envelopeAspectRatio(envelope),
        });
        setProjectSession(event.sender.id, {
          path: recovered.path,
          projectId: recovered.projectId,
        });
        await journal.record({
          type: "open",
          path: recovered.path,
          projectId: recovered.projectId,
          at: new Date().toISOString(),
        });
        return recovered;
      },
    ],
    [
      IpcChannels.projectOpenRecent,
      async (event, payload) => {
        const { id } = parsePayload(openRecentSchema, payload);
        const entry = recent.list().find((item) => item.id === id);
        if (!entry) {
          throw new DesktopIpcError(
            DesktopIpcErrorCode.VALIDATION,
            "Recent project not found.",
          );
        }
        const opened = projects.openPath(entry.path);
        const recovered = await applyJournalOnOpen(
          opened,
          senderWindow(event),
        );
        const envelope = parseDesktopProjectFile(recovered.documentJson);
        recent.touch({
          id: recovered.projectId,
          name: projectNameFromEnvelope(envelope),
          path: recovered.path,
          aspectRatio: envelopeAspectRatio(envelope),
        });
        setProjectSession(event.sender.id, {
          path: recovered.path,
          projectId: recovered.projectId,
        });
        await journal.record({
          type: "open",
          path: recovered.path,
          projectId: recovered.projectId,
          at: new Date().toISOString(),
        });
        return recovered;
      },
    ],
    [
      IpcChannels.projectSave,
      async (event, payload) => {
        const input = parsePayload(saveProjectSchema, payload);
        const session = getProjectSession(event.sender.id);
        const envelope = parseDesktopProjectFile(input.documentJson);
        assertDocumentMatchesSession(session, projectIdFromEnvelope(envelope));
        if (!session?.path) {
          const saved = await projects.saveAsViaDialog(
            input.documentJson,
            undefined,
            senderWindow(event),
          );
          await touchRecent(saved.path, input.documentJson);
          setProjectSession(event.sender.id, {
            path: saved.path,
            projectId: session?.projectId ?? projectIdFromEnvelope(envelope),
          });
          return saved;
        }
        const saved = await projects.saveAtomic(session.path, input.documentJson);
        await touchRecent(saved.path, input.documentJson);
        return saved;
      },
    ],
    [
      IpcChannels.projectSaveAs,
      async (event, payload) => {
        const input = parsePayload(saveProjectAsSchema, payload);
        const session = getProjectSession(event.sender.id);
        const envelope = parseDesktopProjectFile(input.documentJson);
        assertDocumentMatchesSession(session, projectIdFromEnvelope(envelope));
        const saved = await projects.saveAsViaDialog(
          input.documentJson,
          input.suggestedName,
          senderWindow(event),
        );
        await touchRecent(saved.path, input.documentJson);
        setProjectSession(event.sender.id, {
          path: saved.path,
          projectId: projectIdFromEnvelope(envelope),
        });
        await journal.record({
          type: "saveAs",
          path: saved.path,
          projectId: projectIdFromEnvelope(envelope),
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
      IpcChannels.journalStatus,
      (event, payload) => {
        const input = parsePayload(journalLocatorSchema, payload) ?? {};
        return journal.status(journalLocatorFromEvent(event, input.projectId));
      },
    ],
    [
      IpcChannels.journalRecord,
      async (event, payload) => {
        const input = parsePayload(journalRecordSchema, payload);
        if (!journal.enabled) return { recorded: false };
        const locator = journalLocatorFromEvent(event, input.projectId);
        const projectId = locator.projectId ?? input.projectId;
        const { seq } = await journal.recordHistory({
          projectId,
          path: locator.path,
          entryId: input.entryId,
          label: input.label,
          documentJsonHash: input.documentJsonHash,
        });
        return { recorded: true, seq };
      },
    ],
    [
      IpcChannels.journalAutosave,
      async (event, payload) => {
        const input = parsePayload(journalAutosaveSchema, payload);
        if (!journal.enabled) return { saved: false };
        const locator = journalLocatorFromEvent(event, input.projectId);
        const projectId = locator.projectId ?? input.projectId;
        const { seq } = await journal.writeAutosaveSnapshot({
          projectId,
          path: locator.path,
          documentJson: input.documentJson,
        });
        return { saved: true, seq };
      },
    ],
    [
      IpcChannels.journalRecover,
      async (event, payload) => {
        const input = parsePayload(journalLocatorSchema, payload) ?? {};
        return journal.recover(journalLocatorFromEvent(event, input.projectId));
      },
    ],
    [
      IpcChannels.journalDiscard,
      async (event, payload) => {
        const input = parsePayload(journalLocatorSchema, payload) ?? {};
        await journal.discard(journalLocatorFromEvent(event, input.projectId));
      },
    ],
    [
      IpcChannels.assetsImportFiles,
      async (event, payload) => {
        parsePayload(importFilesSchema, payload);
        const session = requireSavedProjectSession(event.sender.id);
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
        const session = requireSavedProjectSession(event.sender.id);
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
        const session = requireSavedProjectSession(event.sender.id);
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
        const session = requireSavedProjectSession(event.sender.id);
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
            projectPath: session?.path ?? undefined,
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
