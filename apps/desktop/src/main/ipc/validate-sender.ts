import type { IpcMainInvokeEvent } from "electron";
import { BrowserWindow } from "electron";
import {
  DesktopIpcError,
  DesktopIpcErrorCode,
} from "../../shared/ipc/errors";
import { isAllowedNavigation } from "../windows/navigation-policy";

/**
 * Ensure the invoke comes from one of our BrowserWindows and an allowed URL.
 */
export function validateSender(event: IpcMainInvokeEvent): void {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.UNAUTHORIZED_SENDER,
      "IPC sender is not an application window.",
    );
  }

  const url = event.sender.getURL();
  // About:blank during early boot — allow only if still owned by our window.
  if (!url || url === "about:blank") return;

  if (!isAllowedNavigation(url)) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.UNAUTHORIZED_SENDER,
      `IPC sender URL is not allowlisted: ${url}`,
    );
  }
}
