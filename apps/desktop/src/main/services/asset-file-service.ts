/**
 * Copy-on-import media files beside a saved .mt project.
 */

import fs from "node:fs";
import path from "node:path";
import { BrowserWindow, dialog, type OpenDialogOptions, type OpenDialogReturnValue } from "electron";
import {
  ASSETS_DIR_NAME,
  projectAssetsDir,
  resolveContainedPath,
  toPosixRelative,
} from "../../shared/assets/resolve-asset-path";
import type {
  AssetType,
  ImportedAsset,
  ListMissingAssetsRequest,
  ListMissingAssetsResult,
  RelinkAssetResult,
  ResolvedAsset,
} from "../../shared/ipc/contracts";
import {
  DesktopIpcError,
  DesktopIpcErrorCode,
} from "../../shared/ipc/errors";
import {
  buildMvmediaUrl,
  ensureProjectMediaToken,
  mimeForExt,
} from "../protocol/mvmedia-registry";
import { probeMediaFile } from "./media-probe";

export type AssetFileFs = {
  existsSync(p: string): boolean;
  mkdir(p: string, opts?: { recursive?: boolean }): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  unlink(p: string): Promise<void>;
};

const MEDIA_FILTERS = [
  {
    name: "Media",
    extensions: ["png", "jpg", "jpeg", "webp", "mp4", "webm", "mp3", "wav"],
  },
  { name: "All Files", extensions: ["*"] },
];

const EXT_PROBE: Record<
  string,
  { mimeType: string; assetType: AssetType }
> = {
  ".png": { mimeType: "image/png", assetType: "image" },
  ".jpg": { mimeType: "image/jpeg", assetType: "image" },
  ".jpeg": { mimeType: "image/jpeg", assetType: "image" },
  ".webp": { mimeType: "image/webp", assetType: "image" },
  ".mp4": { mimeType: "video/mp4", assetType: "video" },
  ".webm": { mimeType: "video/webm", assetType: "video" },
  ".mp3": { mimeType: "audio/mpeg", assetType: "audio" },
  ".wav": { mimeType: "audio/wav", assetType: "audio" },
};

function defaultFs(): AssetFileFs {
  return {
    existsSync: fs.existsSync,
    mkdir: async (p, opts) => {
      await fs.promises.mkdir(p, opts);
    },
    copyFile: (src, dest) => fs.promises.copyFile(src, dest),
    unlink: (p) => fs.promises.unlink(p),
  };
}

function createAssetId(): string {
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function probeExtension(filePath: string): {
  mimeType: string;
  assetType: AssetType;
} {
  const ext = path.extname(filePath).toLowerCase();
  return (
    EXT_PROBE[ext] ?? {
      mimeType: mimeForExt(ext),
      assetType: "unknown" as AssetType,
    }
  );
}

function uniqueDestPath(io: AssetFileFs, assetsDir: string, baseName: string): string {
  const safeBase = path.basename(baseName);
  let candidate = path.join(assetsDir, safeBase);
  if (!io.existsSync(candidate)) return candidate;

  const ext = path.extname(safeBase);
  const stem = path.basename(safeBase, ext);
  let i = 1;
  while (io.existsSync(candidate)) {
    candidate = path.join(assetsDir, `${stem}_${i}${ext}`);
    i += 1;
  }
  return candidate;
}

function assertProjectFileExists(io: AssetFileFs, projectPath: string): void {
  const resolved = path.resolve(projectPath);
  if (!io.existsSync(resolved)) {
    throw new DesktopIpcError(
      DesktopIpcErrorCode.VALIDATION,
      `Project file not found: ${projectPath}. Save the project before importing assets.`,
    );
  }
}

function projectDirOf(projectPath: string): string {
  return path.dirname(path.resolve(projectPath));
}

export type ShowOpenDialogFn = (
  browserWindow: BrowserWindow | undefined,
  options: OpenDialogOptions,
) => Promise<OpenDialogReturnValue>;

export type AssetFileServiceOptions = {
  fs?: AssetFileFs;
  createId?: () => string;
  showOpenDialog?: ShowOpenDialogFn;
  probeMedia?: typeof probeMediaFile;
};

export function createAssetFileService(options: AssetFileServiceOptions = {}) {
  const io = options.fs ?? defaultFs();
  const uid = options.createId ?? createAssetId;
  const probe = options.probeMedia ?? probeMediaFile;
  const showOpenDialog: ShowOpenDialogFn =
    options.showOpenDialog ??
    ((browserWindow, opts) =>
      browserWindow
        ? dialog.showOpenDialog(browserWindow, opts)
        : dialog.showOpenDialog(opts));

  async function pickSourcePaths(
    parent: BrowserWindow | null,
  ): Promise<string[]> {
    const result = await showOpenDialog(parent ?? undefined, {
      title: "Import media",
      properties: ["openFile", "multiSelections"],
      filters: MEDIA_FILTERS,
    });
    if (result.canceled || !result.filePaths.length) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.CANCELLED,
        "Import cancelled.",
      );
    }
    return result.filePaths;
  }

  async function pickRelinkPath(
    parent: BrowserWindow | null,
  ): Promise<string> {
    const result = await showOpenDialog(parent ?? undefined, {
      title: "Relink asset",
      properties: ["openFile"],
      filters: MEDIA_FILTERS,
    });
    if (result.canceled || !result.filePaths[0]) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.CANCELLED,
        "Relink cancelled.",
      );
    }
    return result.filePaths[0];
  }

  async function copyIntoAssets(
    projectPath: string,
    sourcePath: string,
    preferredId?: string,
  ): Promise<ImportedAsset> {
    assertProjectFileExists(io, projectPath);
    const absSource = path.resolve(sourcePath);
    if (!io.existsSync(absSource)) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.MISSING_ASSET,
        `Source file not found: ${sourcePath}`,
      );
    }

    const assetsDir = projectAssetsDir(projectPath);
    await io.mkdir(assetsDir, { recursive: true });

    const dest = uniqueDestPath(io, assetsDir, path.basename(absSource));
    await io.copyFile(absSource, dest);

    const projectDir = projectDirOf(projectPath);
    const uri = toPosixRelative(projectDir, dest);
    if (!uri.startsWith(`${ASSETS_DIR_NAME}/`)) {
      throw new DesktopIpcError(
        DesktopIpcErrorCode.INTERNAL,
        `Copied asset URI is not under assets/: ${uri}`,
      );
    }

    const extProbe = probeExtension(dest);
    if (extProbe.assetType === "unknown") {
      try {
        await io.unlink(dest);
      } catch {
        /* ignore */
      }
      throw new DesktopIpcError(
        DesktopIpcErrorCode.VALIDATION,
        `Unsupported media type: ${path.extname(dest)}`,
      );
    }

    const meta = await probe(dest, extProbe.assetType);

    return {
      id: preferredId ?? uid(),
      uri,
      assetType: extProbe.assetType,
      mimeType: extProbe.mimeType,
      absolutePath: dest,
      ...(meta.width != null ? { width: meta.width } : {}),
      ...(meta.height != null ? { height: meta.height } : {}),
      ...(meta.duration != null ? { duration: meta.duration } : {}),
    };
  }

  return {
    async importFiles(
      projectPath: string,
      paths: string[] | undefined,
      parent: BrowserWindow | null,
    ): Promise<ImportedAsset[]> {
      const sources =
        paths && paths.length > 0 ? paths : await pickSourcePaths(parent);
      const imported: ImportedAsset[] = [];
      const copiedPaths: string[] = [];
      try {
        for (const src of sources) {
          const item = await copyIntoAssets(projectPath, src);
          imported.push(item);
          if (item.absolutePath) copiedPaths.push(item.absolutePath);
        }
        return imported;
      } catch (error) {
        for (const dest of copiedPaths) {
          try {
            await io.unlink(dest);
          } catch {
            /* best-effort rollback */
          }
        }
        throw error;
      }
    },

    resolveUrl(
      projectPath: string,
      assetId: string,
      uri: string,
    ): ResolvedAsset {
      assertProjectFileExists(io, projectPath);
      const projectDir = projectDirOf(projectPath);
      const absolute = resolveContainedPath(projectDir, uri);
      if (!io.existsSync(absolute)) {
        throw new DesktopIpcError(
          DesktopIpcErrorCode.MISSING_ASSET,
          `Asset file missing: ${uri}`,
          { assetId, uri },
        );
      }
      const token = ensureProjectMediaToken(projectDir);
      return {
        assetId,
        url: buildMvmediaUrl(token, uri),
      };
    },

    async relink(
      projectPath: string,
      assetId: string,
      newPath: string | undefined,
      parent: BrowserWindow | null,
    ): Promise<RelinkAssetResult> {
      const source =
        newPath && newPath.length > 0
          ? newPath
          : await pickRelinkPath(parent);
      const imported = await copyIntoAssets(projectPath, source, assetId);
      return {
        assetId: imported.id,
        uri: imported.uri,
        assetType: imported.assetType,
        mimeType: imported.mimeType,
        absolutePath: imported.absolutePath,
        ...(imported.width != null ? { width: imported.width } : {}),
        ...(imported.height != null ? { height: imported.height } : {}),
        ...(imported.duration != null ? { duration: imported.duration } : {}),
      };
    },

    listMissing(input: ListMissingAssetsRequest): ListMissingAssetsResult {
      assertProjectFileExists(io, input.projectPath);
      const projectDir = projectDirOf(input.projectPath);
      const missing: ListMissingAssetsResult["missing"] = [];
      for (const entry of input.assets) {
        try {
          const absolute = resolveContainedPath(projectDir, entry.uri);
          if (!io.existsSync(absolute)) {
            missing.push({ id: entry.id, uri: entry.uri });
          }
        } catch {
          missing.push({ id: entry.id, uri: entry.uri });
        }
      }
      return { missing };
    },
  };
}

export type AssetFileService = ReturnType<typeof createAssetFileService>;
