import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Dev (default): load the running Next.js app.
 * Prod later: point at a bundled standalone server URL or file:// static build.
 */
const DEV_URL = process.env.MOTIONVIDEO_DESKTOP_URL ?? "http://localhost:3000/app";
const isDev = !app.isPackaged;


/**
 * Prefer docked DevTools. Chromium remembers last dock state in Preferences;
 * reset in dev so a prior "undocked" session does not stick.
 *
 * Important: `titleBarOverlay` (WCO) forces DevTools undocked — we use
 * `frame: false` + custom caption buttons instead (Cursor-style).
 */
function preferDockedDevTools(): void {
  if (!isDev) return;
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
  // Must run after the window owns webContents; mode is ignored under WCO.
  contents.openDevTools({ mode: "right", activate: true });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: "MotionVideo",
    backgroundColor: "#0A0A0B",
    // Frameless so DevTools can dock inside (WCO blocks docking).
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 12 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void win.loadURL(DEV_URL);

  if (isDev) {
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
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  preferDockedDevTools();

  ipcMain.handle("desktop:getInfo", () => ({
    platform: process.platform,
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));

  ipcMain.handle("desktop:windowMinimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle("desktop:windowMaximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle("desktop:windowClose", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle("desktop:windowIsMaximized", (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
