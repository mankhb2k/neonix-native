import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow } from "electron";
import { IpcChannels } from "../../shared/ipc/channels";
import { resolveRendererUrl } from "../resolve-renderer-url";
import { attachNavigationPolicy } from "./navigation-policy";

/** Window ids allowed to close after renderer flushed save. */
const pendingCloseAllow = new Set<number>();

const isUnpackaged = !app.isPackaged;

/**
 * Prefer docked DevTools. Chromium remembers last dock state in Preferences;
 * reset in unpackaged so a prior "undocked" session does not stick.
 */
function preferDockedDevTools(): void {
  if (!isUnpackaged) return;
  try {
    const prefsPath = path.join(app.getPath("userData"), "Preferences");
    if (!fs.existsSync(prefsPath)) return;
    const prefs = JSON.parse(fs.readFileSync(prefsPath, "utf8")) as {
      devtools?: { preferences?: Record<string, string> };
    };
    prefs.devtools ??= {};
    prefs.devtools.preferences ??= {};
    prefs.devtools.preferences.currentDockState = '"right"';
    fs.writeFileSync(prefsPath, JSON.stringify(prefs));
  } catch {
    // Ignore corrupt prefs — openDevTools({ mode }) still applies.
  }
}

function toggleDevTools(win: BrowserWindow): void {
  const contents = win.webContents;
  if (contents.isDevToolsOpened()) {
    contents.closeDevTools();
    return;
  }
  contents.openDevTools({ mode: "right", activate: true });
}

function preloadPath(): string {
  // build:main/preload emit beside each other under dist/
  return path.join(__dirname, "../preload/index.js");
}

export function prepareWindowChrome(): void {
  preferDockedDevTools();
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: "MotionVideo",
    backgroundColor: "#0A0A0B",
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 14, y: 12 } : undefined,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on("close", (event) => {
    if (pendingCloseAllow.has(win.id)) {
      pendingCloseAllow.delete(win.id);
      return;
    }
    event.preventDefault();
    win.webContents.send(IpcChannels.requestCloseSave);
  });

  win.once("ready-to-show", () => win.show());

  attachNavigationPolicy(win);

  try {
    void win.loadURL(resolveRendererUrl(app.isPackaged));
  } catch (error) {
    console.error(
      "[motionvideo-desktop]",
      error instanceof Error ? error.message : error,
    );
    app.exit(1);
  }

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(
      `[motionvideo-desktop] did-fail-load code=${code} desc=${desc} url=${url}`,
    );
  });
  win.webContents.on("preload-error", (_e, preloadPath, error) => {
    console.error(
      `[motionvideo-desktop] preload-error path=${preloadPath} error=${error.message}`,
    );
  });

  if (isUnpackaged) {
    win.webContents.on("before-input-event", (event, input) => {
      const isF12 = input.type === "keyDown" && input.key === "F12";
      const isDevShortcut =
        input.type === "keyDown" &&
        input.control &&
        input.shift &&
        input.key.toLowerCase() === "i";
      if (!isF12 && !isDevShortcut) return;
      event.preventDefault();
      toggleDevTools(win);
    });
  }

  return win;
}

export function allowWindowClose(windowId: number): void {
  pendingCloseAllow.add(windowId);
}
