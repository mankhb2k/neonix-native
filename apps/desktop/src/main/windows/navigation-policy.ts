import { shell, type BrowserWindow, type HandlerDetails } from "electron";
import {
  APP_HOST,
  APP_PROTOCOL,
  DEFAULT_LEGACY_URL,
  DEFAULT_VITE_DEV_URL,
  getRendererMode,
  type RendererMode,
} from "../../shared/renderer-mode";

const EXTERNAL_PROTOCOLS = new Set(["https:", "mailto:"]);

function tryParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isAllowedExternalUrl(url: string): boolean {
  const parsed = tryParse(url);
  if (!parsed) return false;
  return EXTERNAL_PROTOCOLS.has(parsed.protocol);
}

export function isAllowedNavigation(
  url: string,
  mode: RendererMode = getRendererMode(),
): boolean {
  const parsed = tryParse(url);
  if (!parsed) return false;

  if (mode === "legacy") {
    const legacy = tryParse(
      process.env.MOTIONVIDEO_DESKTOP_URL ?? DEFAULT_LEGACY_URL,
    );
    if (!legacy) return false;
    return (
      parsed.origin === legacy.origin ||
      parsed.href.startsWith(`${legacy.origin  }/`)
    );
  }

  // Vite mode: app protocol + Vite dev origin.
  if (parsed.protocol === `${APP_PROTOCOL}:` && parsed.hostname === APP_HOST) {
    return true;
  }

  const vite = tryParse(process.env.MOTIONVIDEO_VITE_URL ?? DEFAULT_VITE_DEV_URL);
  if (vite && parsed.origin === vite.origin) return true;

  return false;
}

export function openExternalAllowlisted(url: string): void {
  if (!isAllowedExternalUrl(url)) {
    console.warn(`[motionvideo-desktop] blocked openExternal: ${url}`);
    return;
  }
  void shell.openExternal(url);
}

export function attachNavigationPolicy(win: BrowserWindow): void {
  const mode = getRendererMode();

  win.webContents.on("will-navigate", (event, url) => {
    if (isAllowedNavigation(url, mode)) return;
    event.preventDefault();
    console.warn(`[motionvideo-desktop] blocked navigation: ${url}`);
  });

  win.webContents.setWindowOpenHandler((details: HandlerDetails) => {
    openExternalAllowlisted(details.url);
    return { action: "deny" };
  });
}
