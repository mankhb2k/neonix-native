import { app, BrowserWindow, Menu } from "electron";
import { registerIpcHandlers } from "./ipc/register-ipc-handlers";
import {
  configurePackagedRendererRoot,
  registerAppProtocolHandler,
} from "./protocol/register-app-protocol";
import { registerDesktopSchemesPrivileged } from "./protocol/register-desktop-schemes";
import { registerMvmediaProtocolHandler } from "./protocol/register-mvmedia-protocol";
import { clearAllProjectMediaTokens } from "./protocol/mvmedia-registry";
import {
  getRendererMode,
  setPackagedHint,
} from "../shared/renderer-mode";
import { applyRendererCsp } from "./windows/csp";
import {
  createMainWindow,
  prepareWindowChrome,
} from "./windows/create-main-window";

registerDesktopSchemesPrivileged();
setPackagedHint(app.isPackaged);

const bootStartedAt = Date.now();
let disposeIpc: (() => void) | undefined;

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  prepareWindowChrome();

  if (app.isPackaged) {
    configurePackagedRendererRoot(app.getAppPath());
  }

  registerMvmediaProtocolHandler();

  if (getRendererMode() === "vite") {
    registerAppProtocolHandler();
    applyRendererCsp(app.isPackaged);
  }

  const renderer = getRendererMode();
  const startupMs = Date.now() - bootStartedAt;
  console.info(
    `[motionvideo-desktop] version=${app.getVersion()} packaged=${app.isPackaged} renderer=${renderer} startupMs=${startupMs}`,
  );

  const registered = registerIpcHandlers({
    appVersion: app.getVersion(),
    packaged: app.isPackaged,
    userDataPath: app.getPath("userData"),
  });
  disposeIpc = registered.dispose;

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("before-quit", () => {
  disposeIpc?.();
  disposeIpc = undefined;
  clearAllProjectMediaTokens();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
