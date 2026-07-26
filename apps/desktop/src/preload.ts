import { contextBridge, ipcRenderer } from "electron";

export type DesktopInfo = {
  platform: string;
  version: string;
  packaged: boolean;
};

const desktop = {
  isDesktop: true as const,
  getInfo: (): Promise<DesktopInfo> => ipcRenderer.invoke("desktop:getInfo"),
  windowMinimize: (): Promise<void> => ipcRenderer.invoke("desktop:windowMinimize"),
  windowMaximize: (): Promise<boolean> => ipcRenderer.invoke("desktop:windowMaximize"),
  windowClose: (): Promise<void> => ipcRenderer.invoke("desktop:windowClose"),
  windowIsMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke("desktop:windowIsMaximized"),
};

contextBridge.exposeInMainWorld("motionvideoDesktop", desktop);

export type MotionVideoDesktop = typeof desktop;
