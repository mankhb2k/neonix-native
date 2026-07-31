import type {
  DesktopAPI,
  MotionVideoDesktopBridge,
} from "../../../src/shared/ipc/contracts";

function assertBridge(
  bridge: MotionVideoDesktopBridge | undefined,
): asserts bridge is MotionVideoDesktopBridge {
  if (!bridge?.isDesktop || !bridge.app || !bridge.window) {
    throw new Error(
      "motionvideoDesktop bridge is unavailable. Run inside Electron with preload.",
    );
  }
}

/**
 * Composition-root helper: read window bridge once and return nested DesktopAPI.
 * Feature UI should receive this client via props/context — not touch window.*.
 */
export function createDesktopApiClient(
  bridge: MotionVideoDesktopBridge | undefined = typeof window !== "undefined"
    ? window.motionvideoDesktop
    : undefined,
): DesktopAPI {
  assertBridge(bridge);
  return {
    app: bridge.app,
    window: bridge.window,
    project: bridge.project,
    assets: bridge.assets,
    export: bridge.export,
  };
}
