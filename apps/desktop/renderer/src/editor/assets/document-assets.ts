/**
 * Merge ImportedAsset / Relink results into desktop envelope project.assets
 * with probed metadata when available (Wave E).
 */

import type { AssetType, ImportedAsset } from "../../../../src/shared/ipc/contracts";
import {
  parseDesktopProjectFile,
  serializeDesktopProjectEnvelope,
} from "../../../../src/shared/project-file/envelope";

export type DocumentAssetEntry = {
  id: string;
  uri: string;
  assetType: string;
  mimeType?: string;
  [key: string]: unknown;
};

function placeholderFields(
  assetType: AssetType,
  mimeType: string | undefined,
  probed?: { width?: number; height?: number; duration?: number },
): Record<string, unknown> {
  switch (assetType) {
    case "image": {
      const mime =
        mimeType === "image/jpeg" || mimeType === "image/webp"
          ? mimeType
          : "image/png";
      const hasAlpha = mime !== "image/jpeg";
      return {
        mimeType: mime,
        width: probed?.width && probed.width > 0 ? probed.width : 1,
        height: probed?.height && probed.height > 0 ? probed.height : 1,
        pixelFormat: hasAlpha ? "rgba" : "rgb",
        hasAlpha,
      };
    }
    case "video": {
      const mime = mimeType === "video/webm" ? "video/webm" : "video/mp4";
      return {
        mimeType: mime,
        width: probed?.width && probed.width > 0 ? probed.width : 1920,
        height: probed?.height && probed.height > 0 ? probed.height : 1080,
        duration:
          probed?.duration && probed.duration > 0 ? probed.duration : 1,
        fps: 30,
        videoCodec: "unknown",
        pixelFormat: "yuv420p",
        hasAudio: false,
      };
    }
    case "audio": {
      const mime =
        mimeType === "audio/wav" ||
        mimeType === "audio/aac" ||
        mimeType === "audio/ogg"
          ? mimeType
          : "audio/mpeg";
      return {
        mimeType: mime,
        duration:
          probed?.duration && probed.duration > 0 ? probed.duration : 1,
        codec: "unknown",
        sampleRate: 44100,
        channels: 2,
      };
    }
    case "svg":
      return {
        mimeType: "image/svg+xml",
        width: probed?.width && probed.width > 0 ? probed.width : 1,
        height: probed?.height && probed.height > 0 ? probed.height : 1,
        viewBox: "0 0 1 1",
        sanitized: true,
      };
    case "font":
      return {
        mimeType: mimeType ?? "font/ttf",
        family: "Unknown",
        weight: 400,
        style: "normal",
        localeCoverage: ["und"],
      };
    default:
      return { mimeType };
  }
}

export function toDocumentAsset(imported: {
  id: string;
  uri: string;
  assetType: AssetType;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
}): DocumentAssetEntry {
  return {
    id: imported.id,
    uri: imported.uri,
    assetType: imported.assetType,
    ...placeholderFields(imported.assetType, imported.mimeType, {
      width: imported.width,
      height: imported.height,
      duration: imported.duration,
    }),
  };
}

export function listEnvelopeAssets(documentJson: string): DocumentAssetEntry[] {
  const envelope = parseDesktopProjectFile(documentJson);
  const assets = envelope.project.assets;
  if (!Array.isArray(assets)) return [];
  return assets.filter(
    (row): row is DocumentAssetEntry =>
      Boolean(row) &&
      typeof row === "object" &&
      typeof (row as DocumentAssetEntry).id === "string" &&
      typeof (row as DocumentAssetEntry).uri === "string",
  );
}

export function appendAssetsToDocumentJson(
  documentJson: string,
  imported: ImportedAsset[],
): string {
  const envelope = parseDesktopProjectFile(documentJson);
  const existing = Array.isArray(envelope.project.assets)
    ? [...envelope.project.assets]
    : [];
  const byId = new Set(
    existing
      .filter((row): row is { id: string } =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as { id?: unknown }).id === "string",
      )
      .map((row) => row.id),
  );
  for (const item of imported) {
    if (byId.has(item.id)) continue;
    existing.push(toDocumentAsset(item));
    byId.add(item.id);
  }
  envelope.project.assets = existing;
  return serializeDesktopProjectEnvelope(envelope);
}

export function updateAssetUriInDocumentJson(
  documentJson: string,
  assetId: string,
  next: {
    uri: string;
    assetType: AssetType;
    mimeType?: string;
    width?: number;
    height?: number;
    duration?: number;
  },
): string {
  const envelope = parseDesktopProjectFile(documentJson);
  const assets = Array.isArray(envelope.project.assets)
    ? [...envelope.project.assets]
    : [];
  const index = assets.findIndex(
    (row) =>
      row &&
      typeof row === "object" &&
      (row as { id?: unknown }).id === assetId,
  );
  const docAsset = toDocumentAsset({
    id: assetId,
    uri: next.uri,
    assetType: next.assetType,
    mimeType: next.mimeType,
    width: next.width,
    height: next.height,
    duration: next.duration,
  });
  if (index >= 0) {
    assets[index] = docAsset;
  } else {
    assets.push(docAsset);
  }
  envelope.project.assets = assets;
  return serializeDesktopProjectEnvelope(envelope);
}
