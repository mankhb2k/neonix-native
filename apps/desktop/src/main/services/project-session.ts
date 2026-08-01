import { DesktopIpcError, DesktopIpcErrorCode } from "../../shared/ipc/errors";

/**
 * Main-owned open project identity per BrowserWindow / webContents.
 * path may be null for unsaved projects; projectId is always bound.
 * Renderer must not supply absolute paths for save/import/export.
 */

export type ProjectSession = {
  path: string | null;
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

/** Session with a saved path (assets/export require disk location). */
export function requireSavedProjectSession(
  webContentsId: number,
): ProjectSession & { path: string } {
  const session = requireProjectSession(webContentsId);
  if (!session.path) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.VALIDATION,
      "No open project session. Save the project first, or open a .mt file.",
    );
  }
  return session as ProjectSession & { path: string };
}

/** Reject renderer-supplied projectId that does not match the bound session. */
export function assertSessionProjectId(
  session: ProjectSession | null,
  projectId: string | undefined,
): void {
  if (!projectId) return;
  if (!session) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.VALIDATION,
      "No open project session for journal operation.",
    );
  }
  if (session.projectId !== projectId) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.VALIDATION,
      "Journal projectId does not match the active session.",
    );
  }
}
