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
  body: Buffer;
  contentType: string;
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

export function defaultObjectKey(assetId: string, mimeType: string): string {
  return `assets/${safeAssetStorageId(assetId)}/original.${extensionForMime(mimeType)}`;
}

/** Stable derivative namespace shared by preview and media workers. */
export function derivativeObjectKey(
  assetId: string,
  kind: "audio" | "video" | "poster",
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `assets/${safeAssetStorageId(assetId)}/${kind}/${safeName}`;
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

  createObjectKey(assetId: string, mimeType: string): string {
    return defaultObjectKey(assetId, mimeType);
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
    }));
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

  async headObject(key: string): Promise<{ sizeBytes: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType };
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

export function publicUserAssetUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_ASSETS_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  const path = key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/${path}`;
}
