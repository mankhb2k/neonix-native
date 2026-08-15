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

/**
 * Object storage backend. Memory for local/tests; R2 for production.
 */
export interface StorageProvider {
  readonly kind: "memory" | "r2";
  /** When true, bytes are uploaded to this API (`PUT .../bytes`) instead of a remote presign. */
  readonly usesLocalUploadEndpoint: boolean;
  createObjectKey(assetId: string, mimeType: string): string;
  putObject(input: PutObjectInput): Promise<void>;
  getObject(key: string): Promise<Buffer | null>;
  headObject(key: string): Promise<{ sizeBytes: number; contentType?: string } | null>;
  deleteObject(key: string): Promise<void>;
  presignPut(key: string, contentType: string, expiresInSeconds: number): Promise<PresignPutResult>;
  presignGet(key: string, expiresInSeconds: number): Promise<PresignGetResult>;
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
      return "wav";
    case "audio/aac":
      return "aac";
    case "audio/ogg":
      return "ogg";
    case "font/ttf":
      return "ttf";
    case "font/otf":
      return "otf";
    case "font/woff":
      return "woff";
    case "font/woff2":
      return "woff2";
    default:
      return "bin";
  }
}

export function defaultObjectKey(assetId: string, mimeType: string): string {
  const safeId = assetId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `assets/${safeId}.${extensionForMime(mimeType)}`;
}
