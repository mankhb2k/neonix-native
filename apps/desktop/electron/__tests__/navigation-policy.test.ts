import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  shell: { openExternal: vi.fn() },
}));

import { isAllowedNavigation } from "../main/windows/navigation-policy";

describe("isAllowedNavigation", () => {
  afterEach(() => {
    delete process.env.MOTIONVIDEO_DESKTOP_URL;
    delete process.env.MOTIONVIDEO_VITE_URL;
  });

  describe("legacy mode", () => {
    it("allows same-origin Next desktop URL", () => {
      expect(
        isAllowedNavigation("http://localhost:3000/app", "legacy"),
      ).toBe(true);
      expect(
        isAllowedNavigation("http://localhost:3000/app/editor/x", "legacy"),
      ).toBe(true);
    });

    it("denies other origins", () => {
      expect(isAllowedNavigation("https://evil.example/", "legacy")).toBe(
        false,
      );
      expect(isAllowedNavigation("http://127.0.0.1:5173/", "legacy")).toBe(
        false,
      );
      expect(isAllowedNavigation("app://bundle/index.html", "legacy")).toBe(
        false,
      );
    });

    it("respects MOTIONVIDEO_DESKTOP_URL override", () => {
      process.env.MOTIONVIDEO_DESKTOP_URL = "http://localhost:4000/app";
      expect(
        isAllowedNavigation("http://localhost:4000/app/foo", "legacy"),
      ).toBe(true);
      expect(
        isAllowedNavigation("http://localhost:3000/app", "legacy"),
      ).toBe(false);
    });
  });

  describe("vite mode", () => {
    it("allows app://bundle", () => {
      expect(isAllowedNavigation("app://bundle/index.html", "vite")).toBe(
        true,
      );
      expect(isAllowedNavigation("app://bundle/assets/x.js", "vite")).toBe(
        true,
      );
    });

    it("allows Vite dev origin", () => {
      expect(isAllowedNavigation("http://127.0.0.1:5173/", "vite")).toBe(
        true,
      );
      expect(
        isAllowedNavigation("http://127.0.0.1:5173/src/main.tsx", "vite"),
      ).toBe(true);
    });

    it("denies arbitrary https and wrong app host", () => {
      expect(isAllowedNavigation("https://evil.example/", "vite")).toBe(
        false,
      );
      expect(isAllowedNavigation("app://other/index.html", "vite")).toBe(
        false,
      );
      expect(isAllowedNavigation("file:///C:/Windows", "vite")).toBe(false);
    });

    it("respects MOTIONVIDEO_VITE_URL override", () => {
      process.env.MOTIONVIDEO_VITE_URL = "http://127.0.0.1:5199/";
      expect(isAllowedNavigation("http://127.0.0.1:5199/", "vite")).toBe(
        true,
      );
      expect(isAllowedNavigation("http://127.0.0.1:5173/", "vite")).toBe(
        false,
      );
    });
  });
});
