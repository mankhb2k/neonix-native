import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IpcChannels } from "../shared/ipc/channels";
import type {
  DesktopAPI,
  DesktopInfo,
  ExportEvent,
  MotionVideoDesktopBridge,
} from "../shared/ipc/contracts";
import {
  DesktopIpcError,
  desktopIpcErrorFromUnknown,
  isDesktopIpcErrorPayload,
} from "../shared/ipc/errors";

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, payload)) as T;
  } catch (error) {
    if (isDesktopIpcErrorPayload(error)) {
      throw new DesktopIpcError(error.code, error.message, error.details);
    }
    throw desktopIpcErrorFromUnknown(error);
  }
}

function buildDesktopApi(): MotionVideoDesktopBridge {
  const api: DesktopAPI = {
    app: {
      getInfo: () => invoke<DesktopInfo>(IpcChannels.appGetInfo),
    },
    window: {
      minimize: () => invoke<void>(IpcChannels.windowMinimize),
      toggleMaximize: () => invoke<boolean>(IpcChannels.windowMaximize),
      close: () => invoke<void>(IpcChannels.windowClose),
      isMaximized: () => invoke<boolean>(IpcChannels.windowIsMaximized),
      onRequestCloseSave: (cb) => {
        const listener = () => cb();
        ipcRenderer.on(IpcChannels.requestCloseSave, listener);
        return () => {
          ipcRenderer.removeListener(IpcChannels.requestCloseSave, listener);
        };
      },
      confirmClose: (ok) => invoke<void>(IpcChannels.confirmClose, { ok }),
    },
    project: {
      create: () => invoke(IpcChannels.projectNew),
      open: () => invoke(IpcChannels.projectOpen),
      openPath: (filePath) =>
        invoke(IpcChannels.projectOpenPath, { path: filePath }),
      save: (input) => invoke(IpcChannels.projectSave, input),
      saveAs: (input) => invoke(IpcChannels.projectSaveAs, input),
      getRecent: () => invoke(IpcChannels.projectGetRecent),
    },
    assets: {
      importFiles: (input) =>
        invoke(IpcChannels.assetsImportFiles, input),
      resolveUrl: (input) => invoke(IpcChannels.assetsResolveUrl, input),
      relink: (input) => invoke(IpcChannels.assetsRelink, input),
      listMissing: (input) => invoke(IpcChannels.assetsListMissing, input),
    },
    export: {
      start: (input) => invoke(IpcChannels.exportStart, input),
      cancel: (input) => invoke(IpcChannels.exportCancel, input),
      subscribe: (listener) => {
        const handler = (_event: IpcRendererEvent, payload: unknown) => {
          listener(payload as ExportEvent);
        };
        ipcRenderer.on(IpcChannels.exportEvent, handler);
        return () => {
          ipcRenderer.removeListener(IpcChannels.exportEvent, handler);
        };
      },
    },
  };

  return {
    ...api,
    isDesktop: true,
    getInfo: () => api.app.getInfo(),
    windowMinimize: () => api.window.minimize(),
    windowMaximize: () => api.window.toggleMaximize(),
    windowClose: () => api.window.close(),
    windowIsMaximized: () => api.window.isMaximized(),
    onRequestCloseSave: (cb) => api.window.onRequestCloseSave(cb),
    confirmClose: (ok) => api.window.confirmClose(ok),
  };
}

const desktop = buildDesktopApi();
contextBridge.exposeInMainWorld("motionvideoDesktop", desktop);

export type { MotionVideoDesktopBridge as MotionVideoDesktop };
