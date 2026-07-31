import { describe, expect, it, vi, beforeEach } from "vitest";

const removeHandler = vi.fn();
const handle = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle,
    removeHandler,
  },
  dialog: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(async () => ({ canceled: true })),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({
      id: 1,
      isDestroyed: () => false,
      isMaximized: () => false,
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn(),
    })),
  },
}));

vi.mock("../main/windows/create-main-window", () => ({
  allowWindowClose: vi.fn(),
}));

vi.mock("../main/windows/navigation-policy", () => ({
  isAllowedNavigation: vi.fn(() => true),
}));

vi.mock("../shared/renderer-mode", () => ({
  getRendererMode: vi.fn(() => "vite"),
}));

describe("registerIpcHandlers dispose", () => {
  beforeEach(() => {
    removeHandler.mockClear();
    handle.mockClear();
  });

  it("registers invoke channels and removes them on dispose", async () => {
    const { registerIpcHandlers } = await import(
      "../main/ipc/register-ipc-handlers"
    );
    const { INVOKE_CHANNELS } = await import("../shared/ipc/channels");

    const registered = registerIpcHandlers({
      appVersion: "0.0.1",
      packaged: false,
      userDataPath: "/tmp/motionvideo-test-userdata",
    });

    expect(handle.mock.calls.length).toBe(INVOKE_CHANNELS.length);

    registered.dispose();
    expect(removeHandler.mock.calls.length).toBeGreaterThanOrEqual(
      INVOKE_CHANNELS.length,
    );
    for (const channel of INVOKE_CHANNELS) {
      expect(removeHandler).toHaveBeenCalledWith(channel);
    }
  });
});
