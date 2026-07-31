export type RendererMode = "legacy" | "vite";

/** Set from main once `app.isPackaged` is known (before windows/IPC). */
let packagedHint = false;

export function setPackagedHint(packaged: boolean): void {
  packagedHint = packaged;
}

export function getPackagedHint(): boolean {
  return packagedHint;
}

/**
 * Unpackaged default is `legacy` until review remediation gates pass
 * (timeline parity + packaged export + IPC/FS hardening).
 * Packaged builds still load Vite (`app://`) unless MOTIONVIDEO_RENDERER=legacy.
 * Opt-in Vite unpackaged: MOTIONVIDEO_RENDERER=vite.
 */
export function getRendererMode(): RendererMode {
  const env = (process.env.MOTIONVIDEO_RENDERER ?? "").trim();
  if (env === "legacy") return "legacy";
  if (env === "vite") return "vite";
  if (packagedHint) return "vite";
  return "legacy";
}

/** Simulated or real packaged Vite load via app:// protocol. */
export function useViteProductionBundle(): boolean {
  if (getRendererMode() !== "vite") return false;
  if (packagedHint) return true;
  return (
    process.env.MOTIONVIDEO_VITE_PROD === "1" ||
    process.env.MOTIONVIDEO_VITE_PROD === "true"
  );
}

export const DEFAULT_LEGACY_URL = "http://localhost:3000/app";
export const DEFAULT_VITE_DEV_URL = "http://127.0.0.1:5173/";
export const APP_PROTOCOL = "app";
export const APP_HOST = "bundle";

/** Prod meta CSP for built index.html (no Vite-dev host / no script unsafe-inline). */
export const PROD_RENDERER_CSP = [
  "default-src 'self' app://bundle",
  "script-src 'self' app://bundle",
  "style-src 'self' 'unsafe-inline' app://bundle",
  "img-src 'self' data: blob: app://bundle mvmedia:",
  "media-src 'self' blob: mvmedia:",
  "font-src 'self' data: app://bundle",
  "connect-src 'self' app://bundle",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");
