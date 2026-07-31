import { DesktopIpcError, DesktopIpcErrorCode } from "../../shared/ipc/errors";

/**
 * Main-owned open project path per BrowserWindow / webContents.
 * Renderer must not supply absolute paths for save/import/export.
 */

export type ProjectSession = {
  path: string;
  projectId: string;
};

const sessions = new Map<number, ProjectSession>();

export function setProjectSession(
  webContentsId: number,
  session: ProjectSession,
): void {
  sessions.set(webContentsId, session);
}

export function clearProjectSession(webContentsId: number): void {
  sessions.delete(webContentsId);
}

export function getProjectSession(
  webContentsId: number,
): ProjectSession | null {
  return sessions.get(webContentsId) ?? null;
}

export function requireProjectSession(
  webContentsId: number,
): ProjectSession {
  const session = getProjectSession(webContentsId);
  if (!session) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.VALIDATION,
      "No open project session. Save the project first, or open a .mt file.",
    );
  }
  return session;
}
