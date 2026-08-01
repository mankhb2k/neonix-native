/**
 * Project-relative asset path containment (no absolute identity).
 */

import path from "node:path";
import { DesktopIpcError, DesktopIpcErrorCode } from "../ipc/errors";

export const ASSETS_DIR_NAME = "assets";

/** Directory that holds copied media for a saved .mt file. */
export function projectAssetsDir(projectPath: string): string {
  return path.join(path.dirname(path.resolve(projectPath)), ASSETS_DIR_NAME);
}

/**
 * Resolve a relative asset uri under the project directory.
 * Rejects absolute uris and path escape (`..`).
 */
export function resolveContainedPath(
  projectDir: string,
  relativeUri: string,
): string {
  const uri = relativeUri.replace(/\\/g, "/").trim();
  if (!uri) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.PATH_DENIED,
      "Asset URI is empty.",
    );
  }
  if (path.isAbsolute(uri) || path.isAbsolute(relativeUri)) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.PATH_DENIED,
      `Absolute asset URI is not allowed: ${relativeUri}`,
    );
  }
  if (uri.includes("\0")) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.PATH_DENIED,
      "Invalid asset URI.",
    );
  }

  const base = path.resolve(projectDir);
  const resolved = path.resolve(base, ...uri.split("/").filter(Boolean));
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.PATH_DENIED,
      `Asset escapes project directory: ${relativeUri}`,
    );
  }
  return resolved;
}

export function toPosixRelative(fromDir: string, absoluteFile: string): string {
  return path.relative(fromDir, absoluteFile).split(path.sep).join("/");
}
