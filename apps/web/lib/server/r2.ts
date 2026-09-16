import { Readable } from "node:stream";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type UserBucket = "assets" | "exports" | "system";

export type PutObjectInput = {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  contentLength?: number;
};

export type PresignPutResult = {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
};

export type PresignGetResult = {
  url: string;
  expiresAt: Date;
};

export type R2StorageProviderOptions = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/webp": return "webp";
    case "image/svg+xml": return "svg";
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    case "audio/mpeg": return "mp3";
    case "audio/wav": return "wav";
    case "audio/aac": return "aac";
    case "audio/ogg": return "ogg";
    case "font/ttf": return "ttf";
    case "font/otf": return "otf";
    case "font/woff": return "woff";
    case "font/woff2": return "woff2";
    default: return "bin";
  }
}

function safeAssetStorageId(assetId: string): string {
  const withoutAlias = assetId.startsWith("asset-")
    ? assetId.slice("asset-".length)
    : assetId;
  return withoutAlias.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function safeWorkspaceStorageId(workspaceId: string): string {
  return workspaceId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function defaultObjectKey(workspaceId: string, assetId: string, mimeType: string): string {
  const workspaceStorageId = safeWorkspaceStorageId(workspaceId);
  const storageId = safeAssetStorageId(assetId);
  const extension = extensionForMime(mimeType);

  // Every asset owns a namespace, even when it only has one original object.
  // This keeps future thumbnails, waveforms, proxies, and audio derivatives
  // under one predictable prefix.
  return `media/${workspaceStorageId}/${storageId}/origin.${extension}`;
}

/** User fonts have a dedicated R2 namespace and never share media keys. */
export function fontObjectKey(workspaceId: string, assetId: string, format: string): string {
  const safeWorkspaceId = safeWorkspaceStorageId(workspaceId);
  const safeAssetId = safeAssetStorageId(assetId);
  const safeFormat = format.replace(/[^a-zA-Z0-9]/g, "");
  return `font/${safeWorkspaceId}/${safeAssetId}/origin.${safeFormat}`;
}

/** Stable video derivative keys shared by preview and media workers. */
export function derivativeObjectKey(
  workspaceId: string,
  assetId: string,
  kind: "audio" | "video" | "poster",
  fileName: string,
): string {
  const defaultFileName = kind === "poster"
    ? "poster.webp"
    : kind === "audio"
      ? "audio.m4a"
      : fileName;
  const safeFileName = defaultFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `media/${safeWorkspaceStorageId(workspaceId)}/${safeAssetStorageId(assetId)}/${kind === "video" ? safeName : safeFileName}`;
}

export class R2StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: R2StorageProviderOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: options.endpoint ?? `https://${options.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  createObjectKey(workspaceId: string, assetId: string, mimeType: string): string {
    return defaultObjectKey(workspaceId, assetId, mimeType);
  }

  async copyObject(sourceKey: string, targetKey: string): Promise<void> {
    await this.client.send(new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: encodeURIComponent(`${this.bucket}/${sourceKey}`),
      Key: targetKey,
    }));
  }

  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ...(input.contentLength !== undefined ? { ContentLength: input.contentLength } : {}),
    }));
  }

  async putObjectFromWebStream(input: {
    key: string;
    body: globalThis.ReadableStream<Uint8Array>;
    contentType: string;
    contentLength?: number;
  }): Promise<void> {
    await this.putObject({
      key: input.key,
      body: Readable.fromWeb(input.body as Parameters<typeof Readable.fromWeb>[0]),
      contentType: input.contentType,
      ...(input.contentLength !== undefined ? { contentLength: input.contentLength } : {}),
    });
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch {
      return null;
    }
  }

  async getObjectStream(key: string, range?: string) {
    return this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(range ? { Range: range } : {}),
    }));
  }

  async headObject(key: string): Promise<{ sizeBytes: number; contentType?: string; eTag?: string } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType,
        eTag: result.ETag?.replace(/^"|"$/g, "") || undefined,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async presignPut(key: string, contentType: string, expiresInSeconds: number): Promise<PresignPutResult> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
    return {
      url,
      headers: { "content-type": contentType },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async presignGet(key: string, expiresInSeconds: number): Promise<PresignGetResult> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }
}

const providers = new Map<UserBucket, R2StorageProvider>();

function bucketFor(kind: UserBucket): string {
  const specificName = {
    assets: "R2_USER_ASSETS_BUCKET",
    exports: "R2_USER_EXPORTS_BUCKET",
    system: "R2_SYSTEM_ASSETS_BUCKET",
  }[kind];
  const value = process.env[specificName]?.trim();
  if (value) return value;
  if (kind === "assets") return requiredEnv("R2_BUCKET");
  throw new Error(`Missing ${specificName}`);
}

export function getR2Provider(kind: UserBucket): R2StorageProvider {
  const existing = providers.get(kind);
  if (existing) return existing;

  const provider = new R2StorageProvider({
    accountId: requiredEnv("R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    bucket: bucketFor(kind),
    endpoint: process.env.R2_ENDPOINT?.trim() || undefined,
  });
  providers.set(kind, provider);
  return provider;
}

export function getUserAssetsProvider(): R2StorageProvider {
  return getR2Provider("assets");
}

export function getUserExportsProvider(): R2StorageProvider {
  return getR2Provider("exports");
}

export function getSystemAssetsProvider(): R2StorageProvider {
  return getR2Provider("system");
}

export function publicUserAssetUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_ASSETS_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  const path = key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/${path}`;
}
