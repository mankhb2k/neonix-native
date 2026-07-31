import { app } from "electron";
import { appBundleIndexUrl } from "./protocol/register-app-protocol";
import {
  DEFAULT_LEGACY_URL,
  DEFAULT_VITE_DEV_URL,
  getRendererMode,
  useViteProductionBundle,
} from "../shared/renderer-mode";

export function resolveRendererUrl(isPackaged: boolean = app.isPackaged): string {
  const mode = getRendererMode();

  if (mode === "legacy") {
    return process.env.MOTIONVIDEO_DESKTOP_URL ?? DEFAULT_LEGACY_URL;
  }

  if (isPackaged || useViteProductionBundle()) {
    return appBundleIndexUrl();
  }

  return process.env.MOTIONVIDEO_VITE_URL ?? DEFAULT_VITE_DEV_URL;
}
