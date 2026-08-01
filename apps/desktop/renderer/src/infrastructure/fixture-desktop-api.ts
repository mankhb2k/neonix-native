/**
 * No-op DesktopAPI for ?fixture= screenshot mode (no preload / IPC).
 */

import type { DesktopAPI } from "../../../src/shared/ipc/contracts";

const rejected = (label: string) => async () => {
  throw new Error(`fixture api: ${label} unavailable`);
};

export function createFixtureDesktopApi(): DesktopAPI {
  return {
    app: {
      getInfo: async () => ({
        platform: "fixture",
        version: "0.0.0-fixture",
        packaged: false,
        renderer: "vite",
      }),
    },
    window: {
      minimize: async () => undefined,
      toggleMaximize: async () => false,
      close: async () => undefined,
      isMaximized: async () => false,
      onRequestCloseSave: () => () => undefined,
      confirmClose: async () => undefined,
    },
    project: {
      create: rejected("project.create") as DesktopAPI["project"]["create"],
      open: async () => null,
      openRecent: rejected(
        "project.openRecent",
      ) as DesktopAPI["project"]["openRecent"],
      save: rejected("project.save") as DesktopAPI["project"]["save"],
      saveAs: rejected("project.saveAs") as DesktopAPI["project"]["saveAs"],
      getRecent: async () => [],
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
