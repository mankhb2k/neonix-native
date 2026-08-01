/**
 * No-op DesktopAPI for ?fixture= screenshot mode (no preload / IPC).
 * When Electron preload is present, close-save handshake still wires through
 * so lifecycle E2E can assert dirty confirm (Logic-5).
 */

import type { DesktopAPI } from "../../shared/ipc/contracts";

function rejected(name: string) {
  return async () => {
    throw new Error(`Fixture desktop API: ${name} is unavailable.`);
  };
}

function preloadBridge(): DesktopAPI | null {
  if (typeof window === "undefined") return null;
  const bridge = (
    window as unknown as {
      motionvideoDesktop?: DesktopAPI & { isDesktop?: boolean };
    }
  ).motionvideoDesktop;
  if (!bridge?.window?.onRequestCloseSave) return null;
  return bridge;
}

export function createFixtureDesktopApi(): DesktopAPI {
  return {
    app: {
      getInfo: async () => ({
        platform: "fixture",
        version: "0",
        packaged: false,
        renderer: "vite",
      }),
    },
    window: {
      minimize: async () => undefined,
      toggleMaximize: async () => false,
      close: async () => undefined,
      isMaximized: async () => false,
      onRequestCloseSave: (cb) => {
        const preload = preloadBridge();
        if (preload) return preload.window.onRequestCloseSave(cb);
        return () => undefined;
      },
      confirmClose: async (ok) => {
        const preload = preloadBridge();
        if (preload) await preload.window.confirmClose(ok);
      },
    },
    project: {
      create: rejected("project.create") as DesktopAPI["project"]["create"],
      open: async () => null,
      openRecent: rejected(
        "project.openRecent",
      ) as DesktopAPI["project"]["openRecent"],
      save: async (input) => {
        const preload = preloadBridge();
        if (preload) return preload.project.save(input);
        throw new Error("Fixture desktop API: project.save is unavailable.");
      },
      saveAs: async (input) => {
        const preload = preloadBridge();
        if (preload) return preload.project.saveAs(input);
        throw new Error("Fixture desktop API: project.saveAs is unavailable.");
      },
      getRecent: async () => [],
    },
    journal: {
      status: async () => {
        const preload = preloadBridge();
        if (preload) return preload.journal.status({});
        return {
          enabled: false,
          dirty: false,
          lastSeq: 0,
          hasRecoverableSnapshot: false,
        };
      },
      record: async (input) => {
        const preload = preloadBridge();
        if (preload) return preload.journal.record(input);
        return { recorded: false };
      },
      autosave: async (input) => {
        const preload = preloadBridge();
        if (preload) return preload.journal.autosave(input);
        return { saved: false };
      },
      recover: async (input) => {
        const preload = preloadBridge();
        if (preload) return preload.journal.recover(input);
        return null;
      },
      discard: async (input) => {
        const preload = preloadBridge();
        if (preload) await preload.journal.discard(input);
      },
    },
    assets: {
      importFiles: async () => [],
      resolveUrl: rejected(
        "assets.resolveUrl",
      ) as DesktopAPI["assets"]["resolveUrl"],
      relink: rejected("assets.relink") as DesktopAPI["assets"]["relink"],
      listMissing: async () => ({ missing: [] }),
    },
    export: {
      start: rejected("export.start") as DesktopAPI["export"]["start"],
      cancel: async () => undefined,
      subscribe: () => () => undefined,
    },
  };
}
