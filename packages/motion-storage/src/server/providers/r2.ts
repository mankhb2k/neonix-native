import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  defaultObjectKey,
  type PresignGetResult,
  type PresignPutResult,
  type PutObjectInput,
  type StorageProvider,
} from "./types";

export type R2StorageProviderOptions = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Optional custom public endpoint override. */
  endpoint?: string;
};

export class R2StorageProvider implements StorageProvider {
  readonly kind = "r2" as const;
  readonly usesLocalUploadEndpoint = false;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: R2StorageProviderOptions) {
    const endpoint =
      options.endpoint ??
      `https://${options.accountId}.r2.cloudflarestorage.com`;
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint,
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
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: encodeURIComponent(`${this.bucket}/${sourceKey}`),
        Key: targetKey,
      }),
    );
  }

  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }

  async headObject(
    key: string,
  ): Promise<{ sizeBytes: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async presignPut(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<PresignPutResult> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
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
    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }
}

export function createR2StorageProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): R2StorageProvider {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 provider requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET",
    );
  }
  return new R2StorageProvider({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: env.R2_ENDPOINT,
  });
}
