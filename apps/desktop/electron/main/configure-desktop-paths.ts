import { setRendererRootResolver } from "./protocol/register-app-protocol";
import type { DesktopPaths } from "./desktop-paths";

/**
 * Inject resolved DesktopPaths into protocol handlers.
 * Call once after `app.whenReady` before registering app://.
 */
export function applyDesktopPathsToProtocol(paths: DesktopPaths): void {
  const root = paths.rendererRoot;
  setRendererRootResolver(() => root);
}
