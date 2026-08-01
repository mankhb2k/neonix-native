import { describe, expect, it } from "vitest";
import type { DesktopAPI, MotionVideoDesktopBridge } from "../../shared/ipc/contracts";

/**
 * Shape contract for the preload bridge without loading Electron.
 * Mirrors buildDesktopApi() in preload/index.ts.
 */
function fakeBridge(): MotionVideoDesktopBridge {
  const api: DesktopAPI = {
    app: { getInfo: async () => ({ platform: "test", version: "0", packaged: false, renderer: "vite" }) },
    window: {
      minimize: async () => undefined,
      toggleMaximize: async () => false,
      close: async () => undefined,
      isMaximized: async () => false,
      onRequestCloseSave: (cb) => {
        cb();
        return () => undefined;
      },
      confirmClose: async () => undefined,
    },
    project: {
      create: async () => ({ projectId: "", documentJson: "{}", name: "" }),
      open: async () => null,
      openRecent: async () => ({ path: "", projectId: "", documentJson: "{}" }),
      save: async () => ({ path: "" }),
      saveAs: async () => ({ path: "" }),
      getRecent: async () => [],
    },
    journal: {
      status: async () => ({
        enabled: false,
        dirty: false,
        lastSeq: 0,
        hasRecoverableSnapshot: false,
      }),
      record: async () => ({ recorded: false }),
      autosave: async () => ({ saved: false }),
      recover: async () => null,
      discard: async () => undefined,
    },
    assets: {
      importFiles: async () => [],
      resolveUrl: async () => ({ assetId: "", url: "" }),
      relink: async () => ({ assetId: "", uri: "", assetType: "image" }),
      listMissing: async () => ({ missing: [] }),
    },
    export: {
      start: async () => ({ id: "" }),
      cancel: async () => undefined,
      subscribe: () => () => undefined,
    },
  };

  return {
    ...api,
    isDesktop: true,
    getInfo: () => api.app.getInfo(),
    windowMinimize: () => api.window.minimize(),
    windowMaximize: () => api.window.toggleMaximize(),
    windowClose: () => api.window.close(),
    windowIsMaximized: () => api.window.isMaximized(),
    onRequestCloseSave: (cb) => api.window.onRequestCloseSave(cb),
    confirmClose: (ok) => api.window.confirmClose(ok),
  };
}

describe("preload bridge shape", () => {
  it("exposes nested DesktopAPI and flat shims", () => {
    const bridge = fakeBridge();
    expect(bridge.isDesktop).toBe(true);
    expect(typeof bridge.app.getInfo).toBe("function");
    expect(typeof bridge.window.minimize).toBe("function");
    expect(typeof bridge.project.open).toBe("function");
    expect(typeof bridge.project.create).toBe("function");
    expect(typeof bridge.project.openRecent).toBe("function");
    expect(typeof bridge.assets.importFiles).toBe("function");
    expect(typeof bridge.assets.listMissing).toBe("function");
    expect(typeof bridge.export.subscribe).toBe("function");
    expect(typeof bridge.windowMinimize).toBe("function");
    expect(typeof bridge.getInfo).toBe("function");
    expect(bridge).not.toHaveProperty("invoke");
    expect(bridge).not.toHaveProperty("ipcRenderer");
  });

  it("export.subscribe returns an unsubscribe function", () => {
    const bridge = fakeBridge();
    const unsub = bridge.export.subscribe(() => undefined);
    expect(typeof unsub).toBe("function");
    expect(() => unsub()).not.toThrow();
  });
});
