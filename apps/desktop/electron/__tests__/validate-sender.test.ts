import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
}));

vi.mock("../main/windows/navigation-policy", () => ({
  isAllowedNavigation: vi.fn(),
}));

describe("validateSender", () => {
  it("rejects when sender is not an app window", async () => {
    const { BrowserWindow } = await import("electron");
    const { isAllowedNavigation } = await import(
      "../main/windows/navigation-policy"
    );
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(null);
    vi.mocked(isAllowedNavigation).mockReturnValue(true);

    const { validateSender } = await import("../main/ipc/validate-sender");
    const { DesktopIpcError, DesktopIpcErrorCode } = await import(
      "../../shared/ipc/errors"
    );

    expect(() =>
      validateSender({
        sender: { getURL: () => "http://127.0.0.1:5173/" },
      } as never),
    ).toThrow(DesktopIpcError);

    try {
      validateSender({
        sender: { getURL: () => "http://127.0.0.1:5173/" },
      } as never);
    } catch (error) {
      expect(error).toMatchObject({
        code: DesktopIpcErrorCode.UNAUTHORIZED_SENDER,
      });
    }
  });

  it("rejects disallowed sender URLs", async () => {
    const { BrowserWindow } = await import("electron");
    const { isAllowedNavigation } = await import(
      "../main/windows/navigation-policy"
    );
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue({
      isDestroyed: () => false,
    } as never);
    vi.mocked(isAllowedNavigation).mockReturnValue(false);

    const { validateSender } = await import("../main/ipc/validate-sender");
    const { DesktopIpcErrorCode } = await import("../../shared/ipc/errors");

    try {
      validateSender({
        sender: { getURL: () => "https://evil.example/" },
      } as never);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        code: DesktopIpcErrorCode.UNAUTHORIZED_SENDER,
      });
    }
  });

  it("allows about:blank during boot", async () => {
    const { BrowserWindow } = await import("electron");
    const { isAllowedNavigation } = await import(
      "../main/windows/navigation-policy"
    );
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue({
      isDestroyed: () => false,
    } as never);
    vi.mocked(isAllowedNavigation).mockReturnValue(false);

    const { validateSender } = await import("../main/ipc/validate-sender");
    expect(() =>
      validateSender({
        sender: { getURL: () => "about:blank" },
      } as never),
    ).not.toThrow();
  });
});
