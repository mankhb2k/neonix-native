import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDesktopPaths } from "./desktop-paths";

describe("resolveDesktopPaths", () => {
  it("unpackaged: renderer under appRoot, repo two levels up when render-worker exists", () => {
    const appRoot = path.join("D:", "NextJS", "moticlip", "apps", "desktop");
    const repo = path.join("D:", "NextJS", "moticlip");
    const exists = (p: string) =>
      p === path.join(repo, "apps", "render-worker") ||
      p === path.join(appRoot, "dist-renderer");

    const paths = resolveDesktopPaths({
      appPath: appRoot,
      packaged: false,
      existsSync: exists,
    });

    expect(paths.appRoot).toBe(path.resolve(appRoot));
    expect(paths.rendererRoot).toBe(path.join(path.resolve(appRoot), "dist-renderer"));
    expect(paths.repoRoot).toBe(path.resolve(repo));
  });

  it("packaged: renderer next to appPath, repoRoot = resourcesPath", () => {
    const appPath = path.join("/Applications", "MotiClip.app", "Contents", "Resources", "app.asar");
    const resources = path.join("/Applications", "MotiClip.app", "Contents", "Resources");

    const paths = resolveDesktopPaths({
      appPath,
      resourcesPath: resources,
      packaged: true,
    });

    expect(paths.rendererRoot).toBe(path.join(path.resolve(appPath), "dist-renderer"));
    expect(paths.repoRoot).toBe(path.resolve(resources));
    expect(paths.resourcesRoot).toBe(path.resolve(resources));
  });

  it("does not walk from a fake dist/main __dirname depth", () => {
    // Simulates what broken ../../.. from dist/main would produce.
    const wrongFromDirname = path.resolve(
      path.join("D:", "NextJS", "moticlip", "apps", "desktop", "dist", "main"),
      "../../..",
      "dist-renderer",
    );
    const appRoot = path.join("D:", "NextJS", "moticlip", "apps", "desktop");
    const paths = resolveDesktopPaths({
      appPath: appRoot,
      packaged: false,
      existsSync: (p) =>
        p === path.join(path.resolve(appRoot, "../.."), "apps", "render-worker"),
    });

    expect(paths.rendererRoot).not.toBe(wrongFromDirname);
    expect(paths.rendererRoot).toBe(path.join(path.resolve(appRoot), "dist-renderer"));
  });
});
