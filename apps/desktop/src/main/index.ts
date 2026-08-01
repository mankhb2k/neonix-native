import { app, BrowserWindow, Menu } from "electron";
import {
  getRendererMode,
  setPackagedHint,
} from "../shared/renderer-mode";
import { applyDesktopPathsToProtocol } from "./configure-desktop-paths";
import { resolveDesktopPaths } from "./desktop-paths";
import { registerIpcHandlers } from "./ipc/register-ipc-handlers";
import { clearAllProjectMediaTokens } from "./protocol/mvmedia-registry";
import { registerAppProtocolHandler } from "./protocol/register-app-protocol";
import { registerDesktopSchemesPrivileged } from "./protocol/register-desktop-schemes";
import { registerMvmediaProtocolHandler } from "./protocol/register-mvmedia-protocol";
import { runJournalWorkerSmokeProbe } from "./services/journal-worker-smoke-probe";
import {
  createMainWindow,
  prepareWindowChrome,
} from "./windows/create-main-window";
import { applyRendererCsp } from "./windows/csp";

registerDesktopSchemesPrivileged();
setPackagedHint(app.isPackaged);

const bootStartedAt = Date.now();
let disposeIpc: (() => void) | undefined;

app.whenReady().then(() => {
  // Harness-only: require SMOKE=1 + hex token. Report path forced under temp.
  if (process.env.MOTIONVIDEO_JOURNAL_WORKER_SMOKE === "1") {
    void runJournalWorkerSmokeProbe()
      .then((code) => {
        app.exit(code);
      })
      .catch((error: unknown) => {
        console.error("[journal-worker-smoke] probe crashed", error);
        app.exit(1);
      });
    return;
  }

  Menu.setApplicationMenu(null);
  prepareWindowChrome();

  const paths = resolveDesktopPaths({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    packaged: app.isPackaged,
  });
  applyDesktopPathsToProtocol(paths);

  registerMvmediaProtocolHandler();

  if (getRendererMode() === "vite") {
    registerAppProtocolHandler();
    applyRendererCsp(app.isPackaged);
  }

  const renderer = getRendererMode();
  const startupMs = Date.now() - bootStartedAt;
  console.info(
    `[motionvideo-desktop] version=${app.getVersion()} packaged=${app.isPackaged} renderer=${renderer} startupMs=${startupMs} appRoot=${paths.appRoot} rendererRoot=${paths.rendererRoot} repoRoot=${paths.repoRoot}`,
  );

  const registered = registerIpcHandlers({
    appVersion: app.getVersion(),
    packaged: app.isPackaged,
    userDataPath: app.getPath("userData"),
    repoRoot: paths.repoRoot,
    resourcesRoot: paths.resourcesRoot,
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
