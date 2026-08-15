import { z } from "zod";
import type {
  AssetV1,
  AssetValidationIssue,
} from "@motionvideo/motion-protocol";

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
  asset: AssetV1;
};

export type DownloadUrlResponse = {
  assetId: string;
  url: string;
  expiresAt: string;
};

export type ValidateAssetsRequest = {
  assets: AssetV1[];
};

export type ValidateAssetsResponse = {
  ok: boolean;
  issues: AssetValidationIssue[];
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
  asset?: AssetV1;
  createdAt: string;
  updatedAt: string;
};
