import {
  defaultObjectKey,
  type PresignGetResult,
  type PresignPutResult,
  type PutObjectInput,
  type StorageProvider,
} from "./types";

type MemoryObject = {
  body: Buffer;
  contentType: string;
};

/**
 * In-process object store for tests and local closed-loop without R2.
 * Upload URL points at the Express `PUT /assets/uploads/:id/bytes` route.
 */
export class MemoryStorageProvider implements StorageProvider {
  readonly kind = "memory" as const;
  readonly usesLocalUploadEndpoint = true;
  private readonly objects = new Map<string, MemoryObject>();
  private publicBaseUrl: string;

  constructor(options?: { publicBaseUrl?: string }) {
    this.publicBaseUrl = (options?.publicBaseUrl ?? "http://127.0.0.1:8787").replace(
      /\/$/,
      "",
    );
  }

  setPublicBaseUrl(url: string): void {
    this.publicBaseUrl = url.replace(/\/$/, "");
  }

  createObjectKey(assetId: string, mimeType: string): string {
    return defaultObjectKey(assetId, mimeType);
  }

  async putObject(input: PutObjectInput): Promise<void> {
    this.objects.set(input.key, {
      body: Buffer.from(input.body),
      contentType: input.contentType,
    });
  }

  async getObject(key: string): Promise<Buffer | null> {
    const obj = this.objects.get(key);
    return obj ? Buffer.from(obj.body) : null;
  }

  async headObject(
    key: string,
  ): Promise<{ sizeBytes: number; contentType?: string } | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return { sizeBytes: obj.body.byteLength, contentType: obj.contentType };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async presignPut(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<PresignPutResult> {
    const assetId = key.split("/").pop()?.replace(/\.[^.]+$/, "") ?? key;
    // Local upload path is rewritten by AssetService to include pending id.
    void assetId;
    void contentType;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return {
      url: `${this.publicBaseUrl}/assets/uploads/_pending_/bytes`,
      headers: { "content-type": contentType },
      expiresAt,
    };
  }

  async presignGet(key: string, expiresInSeconds: number): Promise<PresignGetResult> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const token = Buffer.from(key).toString("base64url");
    return {
      url: `${this.publicBaseUrl}/assets/objects/${token}`,
      expiresAt,
    };
  }
}
