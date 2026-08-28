import { z } from "zod";
/** Storage API asset DTO. Kept local so storage does not depend on authoring protocol versions. */
export type StorageAsset = {
  id: string;
  assetType: "image" | "svg" | "video" | "audio" | "font";
  mimeType: string;
  uri?: string;
  integrity?: string;
  sizeBytes?: number;
  name?: string;
  storage?: { managed: boolean; provider: string; key: string; retention: string };
  source?: { kind: "upload"; originalName?: string };
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  sampleRate?: number;
  channels?: number;
  family?: string;
  weight?: number;
  style?: "normal" | "italic";
  sanitized?: boolean;
};

export type StorageValidationIssue = {
  layer: "storage";
  code: string;
  assetId?: string;
  path?: string;
  message: string;
};

export const CreateUploadRequestSchema = z
  .object({
    assetType: z.enum(["image", "svg", "video", "audio", "font"]),
    mimeType: z.string().min(1),
    name: z.string().min(1).optional(),
    retention: z
      .enum(["temporary", "project", "library", "permanent"])
      .default("temporary"),
    // Declared media metadata — verified for size/hash on complete; dims trusted in MVP.
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().positive().optional(),
    fps: z.number().positive().optional(),
    family: z.string().min(1).optional(),
    weight: z.number().int().min(1).max(1000).optional(),
    style: z.enum(["normal", "italic"]).optional(),
  })
  .strict();

export type CreateUploadRequest = z.input<typeof CreateUploadRequestSchema>;
export type CreateUploadRequestParsed = z.output<typeof CreateUploadRequestSchema>;

export type CreateUploadResponse = {
  assetId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
  storageKey: string;
};

export type CompleteUploadResponse = {
  asset: StorageAsset;
};

export type DownloadUrlResponse = {
  assetId: string;
  url: string;
  expiresAt: string;
};

export type ValidateAssetsRequest = {
  assets: StorageAsset[];
};

export type ValidateAssetsResponse = {
  ok: boolean;
  issues: StorageValidationIssue[];
};

export type StoredAssetRecord = {
  id: string;
  status: "pending" | "ready" | "deleted";
  storageKey: string;
  /** Nhãn copy vào JSON — kho không GC file ready theo field này. */
  retention: "temporary" | "project" | "library" | "permanent";
  /** Chỉ session pending (chưa complete). Null khi ready. */
  pendingExpiresAt: string | null;
  mimeType: string;
  assetType: CreateUploadRequestParsed["assetType"];
  name?: string;
  declared: Omit<
    CreateUploadRequestParsed,
    "assetType" | "mimeType" | "name" | "retention"
  >;
  sizeBytes?: number;
  integrity?: string;
  asset?: StorageAsset;
  createdAt: string;
  updatedAt: string;
};
