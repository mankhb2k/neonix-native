import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  net: {},
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  },
}));

import {
  resetRendererRootResolver,
  resolveBundlePath,
  setRendererRootResolver,
} from "./register-app-protocol";
import { setPackagedHint } from "../../../shared/renderer-mode";

const ROOT = path.resolve("/tmp/motionvideo-fake-dist-renderer");

describe("resolveBundlePath", () => {
  afterEach(() => {
    resetRendererRootResolver();
    setPackagedHint(false);
    delete process.env.MOTIONVIDEO_RELEASE;
  });

  it("resolves index.html for app://bundle/", () => {
    setRendererRootResolver(() => ROOT);
    expect(resolveBundlePath("app://bundle/")).toBe(
      path.resolve(ROOT, "index.html"),
    );
  });

  it("resolves nested assets under root", () => {
    setRendererRootResolver(() => ROOT);
    expect(resolveBundlePath("app://bundle/assets/app.js")).toBe(
      path.resolve(ROOT, "assets", "app.js"),
    );
  });

  it("rejects path traversal and escape attempts", () => {
    setRendererRootResolver(() => ROOT);
    // Encoded slash keeps ".." as a path segment after decode.
    expect(resolveBundlePath("app://bundle/..%2Fsecret.txt")).toBeNull();
    expect(resolveBundlePath("app://bundle/foo/..%2F..%2Fsecret.txt")).toBeNull();
    // URL-normalized ../ stays inside host root — still not outside ROOT.
    expect(resolveBundlePath("app://bundle/../inside.txt")).toBe(
      path.resolve(ROOT, "inside.txt"),
    );
  });

  it("rejects non-app protocols and wrong host", () => {
    setRendererRootResolver(() => ROOT);
    expect(resolveBundlePath("file:///etc/passwd")).toBeNull();
    expect(resolveBundlePath("app://other/index.html")).toBeNull();
  });

  it("refuses .map when packaged", () => {
    setRendererRootResolver(() => ROOT);
    setPackagedHint(true);
    expect(resolveBundlePath("app://bundle/assets/app.js.map")).toBeNull();
  });

  it("refuses .map when MOTIONVIDEO_RELEASE=1", () => {
    setRendererRootResolver(() => ROOT);
    process.env.MOTIONVIDEO_RELEASE = "1";
    expect(resolveBundlePath("app://bundle/assets/app.js.map")).toBeNull();
  });

  it("allows .map when explicitly opted in", () => {
    setRendererRootResolver(() => ROOT);
    setPackagedHint(true);
    expect(
      resolveBundlePath("app://bundle/assets/app.js.map", {
        allowSourceMaps: true,
      }),
    ).toBe(path.resolve(ROOT, "assets", "app.js.map"));
  });
});
