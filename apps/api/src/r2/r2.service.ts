import { Readable } from "node:stream";
import { Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Ported from apps/web/lib/server/r2.ts - same object-key conventions and
// presign behavior, trimmed to what apps/api's asset routes need so far
// (user asset uploads only; system/export buckets aren't wired yet).

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

function safeStorageId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function defaultObjectKey(workspaceId: string, assetId: string, mimeType: string): string {
  return `media/${safeStorageId(workspaceId)}/${safeStorageId(assetId)}/origin.${extensionForMime(mimeType)}`;
}

export type PresignPutResult = {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
};

@Injectable()
export class R2Service {
  private client: S3Client | null = null;
  private bucket: string | null = null;

  private ensureClient(): { client: S3Client; bucket: string } {
    if (this.client && this.bucket) return { client: this.client, bucket: this.bucket };
    this.bucket = requiredEnv("R2_USER_ASSETS_BUCKET");
    this.client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT?.trim() || `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
    return { client: this.client, bucket: this.bucket };
  }

  async putObject(input: { key: string; body: Buffer | Readable; contentType: string }): Promise<void> {
    const { client, bucket } = this.ensureClient();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: input.key, Body: input.body, ContentType: input.contentType }));
  }

  async getObject(key: string): Promise<Buffer | null> {
    const { client, bucket } = this.ensureClient();
    try {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch {
      return null;
    }
  }

  async headObject(key: string): Promise<{ sizeBytes: number; contentType?: string } | null> {
    const { client, bucket } = this.ensureClient();
    try {
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const { client, bucket } = this.ensureClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async presignPut(key: string, contentType: string, expiresInSeconds: number): Promise<PresignPutResult> {
    const { client, bucket } = this.ensureClient();
    const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
      expiresIn: expiresInSeconds,
    });
    return { url, headers: { "content-type": contentType }, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }
}
