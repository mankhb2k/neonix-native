/** Canonical IPC channel names — do not hardcode literals outside this module. */

export const IpcChannels = {
  appGetInfo: "desktop:getInfo",

  windowMinimize: "desktop:windowMinimize",
  windowMaximize: "desktop:windowMaximize",
  windowClose: "desktop:windowClose",
  windowIsMaximized: "desktop:windowIsMaximized",
  confirmClose: "desktop:confirmClose",
  requestCloseSave: "desktop:requestCloseSave",

  projectNew: "desktop:project.new",
  projectOpen: "desktop:project.open",
  projectOpenPath: "desktop:project.openPath",
  projectSave: "desktop:project.save",
  projectSaveAs: "desktop:project.saveAs",
  projectGetRecent: "desktop:project.getRecent",

  assetsImportFiles: "desktop:assets.importFiles",
  assetsResolveUrl: "desktop:assets.resolveUrl",
  assetsRelink: "desktop:assets.relink",
  assetsListMissing: "desktop:assets.listMissing",

  exportStart: "desktop:export.start",
  exportCancel: "desktop:export.cancel",
  exportEvent: "desktop:export.event",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** Invoke channels registered via ipcMain.handle (excludes push-only events). */
export const INVOKE_CHANNELS: readonly IpcChannel[] = [
  IpcChannels.appGetInfo,
  IpcChannels.windowMinimize,
  IpcChannels.windowMaximize,
  IpcChannels.windowClose,
  IpcChannels.windowIsMaximized,
  IpcChannels.confirmClose,
  IpcChannels.projectNew,
  IpcChannels.projectOpen,
  IpcChannels.projectOpenPath,
  IpcChannels.projectSave,
  IpcChannels.projectSaveAs,
  IpcChannels.projectGetRecent,
  IpcChannels.assetsImportFiles,
  IpcChannels.assetsResolveUrl,
  IpcChannels.assetsRelink,
  IpcChannels.assetsListMissing,
  IpcChannels.exportStart,
  IpcChannels.exportCancel,
];
