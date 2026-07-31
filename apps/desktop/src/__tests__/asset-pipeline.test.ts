import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  projectAssetsDir,
  resolveContainedPath,
} from "../shared/assets/resolve-asset-path";
import { DesktopIpcError, DesktopIpcErrorCode } from "../shared/ipc/errors";
import {
  buildMvmediaUrl,
  clearAllProjectMediaTokens,
  ensureProjectMediaToken,
  parseMvmediaUrl,
} from "../main/protocol/mvmedia-registry";
import { createAssetFileService } from "../main/services/asset-file-service";

describe("resolveContainedPath", () => {
  const root = path.join(os.tmpdir(), "mv-asset-path-root");

  it("resolves relative assets under project dir", () => {
    const resolved = resolveContainedPath(root, "assets/logo.png");
    expect(resolved).toBe(path.resolve(root, "assets", "logo.png"));
  });

  it("rejects absolute URIs", () => {
    expect(() =>
      resolveContainedPath(root, path.resolve(root, "assets", "x.png")),
    ).toThrow(DesktopIpcError);
    try {
      resolveContainedPath(root, path.resolve(root, "assets", "x.png"));
    } catch (err) {
      expect(err).toBeInstanceOf(DesktopIpcError);
      expect((err as DesktopIpcError).code).toBe(
        DesktopIpcErrorCode.PATH_DENIED,
      );
    }
  });

  it("rejects path escape with ..", () => {
    expect(() =>
      resolveContainedPath(root, "assets/../../outside.png"),
    ).toThrowError(/escapes/);
  });
});

describe("mvmedia registry", () => {
  afterEach(() => {
    clearAllProjectMediaTokens();
  });

  it("round-trips url parse", () => {
    const token = ensureProjectMediaToken("/proj");
    const url = buildMvmediaUrl(token, "assets/foo bar.png");
    const parsed = parseMvmediaUrl(url);
    expect(parsed).toEqual({
      token,
      relativeUri: "assets/foo bar.png",
    });
  });

  it("reuses token for same project dir", () => {
    const a = ensureProjectMediaToken(path.resolve("/tmp/p"));
    const b = ensureProjectMediaToken(path.resolve("/tmp/p"));
    expect(a).toBe(b);
  });
});

describe("asset-file-service", () => {
  const dirs: string[] = [];

  afterEach(() => {
    clearAllProjectMediaTokens();
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeProject(): { dir: string; projectPath: string; source: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-assets-"));
    dirs.push(dir);
    const projectPath = path.join(dir, "demo.mt");
    fs.writeFileSync(projectPath, "{}\n", "utf8");
    const source = path.join(dir, "source.png");
    fs.writeFileSync(source, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    return { dir, projectPath, source };
  }

  it("copies import beside .mt with relative uri", async () => {
    const { projectPath, source } = makeProject();
    let n = 0;
    const service = createAssetFileService({
      createId: () => `asset_test_${++n}`,
    });
    const imported = await service.importFiles(projectPath, [source], null);
    expect(imported).toHaveLength(1);
    expect(imported[0]!.id).toBe("asset_test_1");
    expect(imported[0]!.uri).toBe("assets/source.png");
    expect(imported[0]!.assetType).toBe("image");
    expect(imported[0]!.mimeType).toBe("image/png");
    expect(fs.existsSync(path.join(projectAssetsDir(projectPath), "source.png"))).toBe(
      true,
    );
  });

  it("resolveUrl works after moving the project folder", async () => {
    const { dir, projectPath, source } = makeProject();
    const service = createAssetFileService({ createId: () => "asset_move" });
    const [imported] = await service.importFiles(projectPath, [source], null);

    const movedDir = path.join(path.dirname(dir), `${path.basename(dir)}-moved`);
    fs.renameSync(dir, movedDir);
    dirs.push(movedDir);
    const movedProject = path.join(movedDir, "demo.mt");

    const resolved = service.resolveUrl(
      movedProject,
      imported!.id,
      imported!.uri,
    );
    expect(resolved.url.startsWith("mvmedia://media/")).toBe(true);
    expect(resolved.url.includes("assets/source.png")).toBe(true);
  });

  it("listMissing flags deleted files", async () => {
    const { projectPath, source } = makeProject();
    const service = createAssetFileService({ createId: () => "asset_miss" });
    const [imported] = await service.importFiles(projectPath, [source], null);
    fs.unlinkSync(imported!.absolutePath!);

    const result = service.listMissing({
      projectPath,
      assets: [{ id: imported!.id, uri: imported!.uri }],
    });
    expect(result.missing).toEqual([
      { id: imported!.id, uri: imported!.uri },
    ]);
  });

  it("relink copies a replacement and keeps asset id", async () => {
    const { dir, projectPath, source } = makeProject();
    const service = createAssetFileService({ createId: () => "asset_relink" });
    const [imported] = await service.importFiles(projectPath, [source], null);
    fs.unlinkSync(imported!.absolutePath!);

    const replacement = path.join(dir, "replacement.jpg");
    fs.writeFileSync(replacement, Buffer.from([0xff, 0xd8, 0xff]));

    const relinked = await service.relink(
      projectPath,
      imported!.id,
      replacement,
      null,
    );
    expect(relinked.assetId).toBe(imported!.id);
    expect(relinked.uri).toBe("assets/replacement.jpg");
    expect(relinked.mimeType).toBe("image/jpeg");
    expect(fs.existsSync(path.join(projectAssetsDir(projectPath), "replacement.jpg"))).toBe(
      true,
    );
  });

  it("resolveUrl throws MISSING_ASSET when file absent", async () => {
    const { projectPath } = makeProject();
    const service = createAssetFileService();
    expect(() =>
      service.resolveUrl(projectPath, "asset_x", "assets/nope.png"),
    ).toThrow(DesktopIpcError);
    try {
      service.resolveUrl(projectPath, "asset_x", "assets/nope.png");
    } catch (err) {
      expect((err as DesktopIpcError).code).toBe(
        DesktopIpcErrorCode.MISSING_ASSET,
      );
    }
  });
});
