import { createHash, randomUUID } from "node:crypto";
import type { AssetV1 } from "@motionvideo/motion-protocol";
import type {
  CompleteUploadResponse,
  CreateUploadRequest,
  CreateUploadRequestParsed,
  CreateUploadResponse,
  DownloadUrlResponse,
  StoredAssetRecord,
  ValidateAssetsResponse,
} from "../types";
import type { AssetMetadataStore } from "./metadata";
import type { StorageProvider } from "./providers/types";
import { CreateUploadRequestSchema } from "../types";

const TEMPORARY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_UPLOAD_TTL_SECONDS = 15 * 60;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 15 * 60;

export type AssetServiceOptions = {
  provider: StorageProvider;
  metadata: AssetMetadataStore;
  /** Public base URL for memory upload/download links. */
  publicBaseUrl: string;
  clock?: () => Date;
  uploadTtlSeconds?: number;
  downloadTtlSeconds?: number;
};

export class AssetServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AssetServiceError";
  }
}

export class AssetService {
  private readonly provider: StorageProvider;
  private readonly metadata: AssetMetadataStore;
  private publicBaseUrl: string;
  private readonly clock: () => Date;
  private readonly uploadTtlSeconds: number;
  private readonly downloadTtlSeconds: number;

  constructor(options: AssetServiceOptions) {
    this.provider = options.provider;
    this.metadata = options.metadata;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, "");
    this.clock = options.clock ?? (() => new Date());
    this.uploadTtlSeconds = options.uploadTtlSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS;
    this.downloadTtlSeconds =
      options.downloadTtlSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS;
  }

  setPublicBaseUrl(url: string): void {
    this.publicBaseUrl = url.replace(/\/$/, "");
  }

  async createUpload(input: CreateUploadRequest): Promise<CreateUploadResponse> {
    const parsed: CreateUploadRequestParsed = CreateUploadRequestSchema.parse(input);
    if (parsed.retention !== "temporary") {
      throw new AssetServiceError(
        400,
        "retention_unsupported",
        `MVP only supports retention "temporary" (got "${parsed.retention}")`,
      );
    }

    const now = this.clock();
    const assetId = `asset.${parsed.assetType}.${randomUUID()}`;
    const storageKey = this.provider.createObjectKey(assetId, parsed.mimeType);
    const {
      assetType: _assetType,
      mimeType: _mimeType,
      name: _name,
      retention: _retention,
      ...declared
    } = parsed;

    const record: StoredAssetRecord = {
      id: assetId,
      status: "pending",
      storageKey,
      retention: "temporary",
      expiresAt: new Date(now.getTime() + TEMPORARY_TTL_MS).toISOString(),
      mimeType: parsed.mimeType,
      assetType: parsed.assetType,
      name: parsed.name,
      declared,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.metadata.put(record);

    let uploadUrl: string;
    let headers: Record<string, string>;
    let expiresAt: Date;

    if (this.provider.usesLocalUploadEndpoint) {
      expiresAt = new Date(now.getTime() + this.uploadTtlSeconds * 1000);
      uploadUrl = `${this.publicBaseUrl}/assets/uploads/${assetId}/bytes`;
      headers = { "content-type": parsed.mimeType };
    } else {
      const signed = await this.provider.presignPut(
        storageKey,
        parsed.mimeType,
        this.uploadTtlSeconds,
      );
      uploadUrl = signed.url;
      headers = signed.headers;
      expiresAt = signed.expiresAt;
    }

    return {
      assetId,
      uploadUrl,
      method: "PUT",
      headers,
      expiresAt: expiresAt.toISOString(),
      storageKey,
    };
  }

  async putUploadBytes(assetId: string, body: Buffer): Promise<void> {
    const record = await this.requireRecord(assetId);
    if (record.status !== "pending") {
      throw new AssetServiceError(
        409,
        "invalid_status",
        `Asset "${assetId}" is not pending upload`,
      );
    }
    await this.provider.putObject({
      key: record.storageKey,
      body,
      contentType: record.mimeType,
    });
  }

  async completeUpload(assetId: string): Promise<CompleteUploadResponse> {
    const record = await this.requireRecord(assetId);
    if (record.status === "deleted") {
      throw new AssetServiceError(410, "deleted", `Asset "${assetId}" was deleted`);
    }
    if (record.status === "ready" && record.asset) {
      return { asset: record.asset };
    }

    const head = await this.provider.headObject(record.storageKey);
    if (!head) {
      throw new AssetServiceError(
        400,
        "upload_missing",
        `No object found for asset "${assetId}"; upload bytes first`,
      );
    }

    const bytes = await this.provider.getObject(record.storageKey);
    if (!bytes) {
      throw new AssetServiceError(
        400,
        "upload_missing",
        `Unable to read object for asset "${assetId}"`,
      );
    }

    const integrity = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    const asset = buildManagedAssetV1(record, head.sizeBytes, integrity);
    const now = this.clock().toISOString();
    const next: StoredAssetRecord = {
      ...record,
      status: "ready",
      sizeBytes: head.sizeBytes,
      integrity,
      asset,
      updatedAt: now,
    };
    await this.metadata.put(next);
    return { asset };
  }

  async getDownloadUrl(assetId: string): Promise<DownloadUrlResponse> {
    const record = await this.requireRecord(assetId);
    if (record.status !== "ready") {
      throw new AssetServiceError(
        409,
        "not_ready",
        `Asset "${assetId}" is not ready`,
      );
    }
    this.assertNotExpired(record);

    const signed = await this.provider.presignGet(
      record.storageKey,
      this.downloadTtlSeconds,
    );
    // Memory provider embeds a opaque token path; rewrite base if needed.
    let url = signed.url;
    if (this.provider.usesLocalUploadEndpoint) {
      const token = Buffer.from(record.storageKey).toString("base64url");
      url = `${this.publicBaseUrl}/assets/objects/${token}`;
    }
    return {
      assetId,
      url,
      expiresAt: signed.expiresAt.toISOString(),
    };
  }

  async getObjectByToken(token: string): Promise<{
    body: Buffer;
    contentType: string;
  } | null> {
    let key: string;
    try {
      key = Buffer.from(token, "base64url").toString("utf8");
    } catch {
      return null;
    }
    const body = await this.provider.getObject(key);
    if (!body) return null;
    const head = await this.provider.headObject(key);
    return {
      body,
      contentType: head?.contentType ?? "application/octet-stream",
    };
  }

  async validateAssets(assets: AssetV1[]): Promise<ValidateAssetsResponse> {
    const issues: ValidateAssetsResponse["issues"] = [];
    for (const asset of assets) {
      if (asset.storage?.managed !== true) continue;
      const record = await this.metadata.get(asset.id);
      if (!record || record.status === "deleted") {
        issues.push({
          assetId: asset.id,
          code: record?.status === "deleted" ? "deleted" : "missing",
          message: `Managed asset "${asset.id}" is not available`,
        });
        continue;
      }
      if (record.status !== "ready") {
        issues.push({
          assetId: asset.id,
          code: "missing",
          message: `Managed asset "${asset.id}" is not ready`,
        });
        continue;
      }
      try {
        this.assertNotExpired(record);
      } catch {
        issues.push({
          assetId: asset.id,
          code: "expired",
          message: `Managed asset "${asset.id}" temporary retention expired`,
        });
        continue;
      }
      if (asset.integrity && record.integrity && asset.integrity !== record.integrity) {
        issues.push({
          assetId: asset.id,
          code: "integrity_mismatch",
          message: `Integrity mismatch for "${asset.id}"`,
        });
      }
      if (
        asset.sizeBytes !== undefined &&
        record.sizeBytes !== undefined &&
        asset.sizeBytes !== record.sizeBytes
      ) {
        issues.push({
          assetId: asset.id,
          code: "size_mismatch",
          message: `Size mismatch for "${asset.id}"`,
        });
      }
    }
    return { ok: issues.length === 0, issues };
  }

  async deleteAsset(assetId: string): Promise<void> {
    const record = await this.metadata.get(assetId);
    if (!record) {
      throw new AssetServiceError(404, "not_found", `Asset "${assetId}" not found`);
    }
    await this.provider.deleteObject(record.storageKey);
    const now = this.clock().toISOString();
    await this.metadata.put({
      ...record,
      status: "deleted",
      updatedAt: now,
      asset: undefined,
    });
  }

  private async requireRecord(assetId: string): Promise<StoredAssetRecord> {
    const record = await this.metadata.get(assetId);
    if (!record) {
      throw new AssetServiceError(404, "not_found", `Asset "${assetId}" not found`);
    }
    return record;
  }

  private assertNotExpired(record: StoredAssetRecord): void {
    if (record.retention !== "temporary" || !record.expiresAt) return;
    if (this.clock().getTime() > Date.parse(record.expiresAt)) {
      throw new AssetServiceError(
        410,
        "expired",
        `Asset "${record.id}" temporary retention expired`,
      );
    }
  }
}

function buildManagedAssetV1(
  record: StoredAssetRecord,
  sizeBytes: number,
  integrity: string,
): AssetV1 {
  const base = {
    id: record.id,
    integrity,
    sizeBytes,
    name: record.name,
    storage: {
      managed: true as const,
      provider: "r2" as const,
      key: record.storageKey,
      retention: record.retention,
    },
    source: {
      kind: "upload" as const,
      originalName: record.name,
      importedAt: record.createdAt,
    },
  };

  switch (record.assetType) {
    case "image":
      return {
        ...base,
        assetType: "image",
        mimeType: record.mimeType as "image/png" | "image/jpeg" | "image/webp",
        width: requireDim(record, "width"),
        height: requireDim(record, "height"),
      };
    case "svg":
      return {
        ...base,
        assetType: "svg",
        mimeType: "image/svg+xml",
        width: requireDim(record, "width"),
        height: requireDim(record, "height"),
        sanitized: true,
      };
    case "video":
      return {
        ...base,
        assetType: "video",
        mimeType: record.mimeType as "video/mp4" | "video/webm",
        width: requireDim(record, "width"),
        height: requireDim(record, "height"),
        duration: requireNumber(record, "duration"),
        fps: requireNumber(record, "fps"),
      };
    case "audio":
      return {
        ...base,
        assetType: "audio",
        mimeType: record.mimeType as
          | "audio/mpeg"
          | "audio/wav"
          | "audio/aac"
          | "audio/ogg",
        duration: requireNumber(record, "duration"),
        sampleRate: 48000,
        channels: 2,
      };
    case "font":
      return {
        ...base,
        assetType: "font",
        mimeType: record.mimeType as
          | "font/ttf"
          | "font/otf"
          | "font/woff"
          | "font/woff2",
        family: record.declared.family ?? record.name ?? "Unknown",
        weight: record.declared.weight ?? 400,
        style: record.declared.style ?? "normal",
      };
  }
}

function requireDim(record: StoredAssetRecord, key: "width" | "height"): number {
  const value = record.declared[key];
  if (typeof value !== "number") {
    throw new AssetServiceError(
      400,
      "metadata_missing",
      `Upload for "${record.id}" missing declared ${key}`,
    );
  }
  return value;
}

function requireNumber(
  record: StoredAssetRecord,
  key: "duration" | "fps",
): number {
  const value = record.declared[key];
  if (typeof value !== "number") {
    throw new AssetServiceError(
      400,
      "metadata_missing",
      `Upload for "${record.id}" missing declared ${key}`,
    );
  }
  return value;
}
