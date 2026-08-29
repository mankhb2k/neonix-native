export type {
  CreateUploadRequest,
  CreateUploadResponse,
  CompleteUploadResponse,
  DownloadUrlResponse,
  ValidateAssetsRequest,
  ValidateAssetsResponse,
  StoredAssetRecord,
  StorageAsset,
} from "./types";
export { CreateUploadRequestSchema } from "./types";

export {
  type AssetUrlResolver,
  isManagedAsset,
  resolveAssetUri,
  resolveProjectAssetUris,
  createMapAssetUrlResolver,
} from "./resolve";

export {
  createAssetStorageClient,
  type AssetStorageClient,
  type AssetStorageClientOptions,
} from "./client";

export type { StorageValidationIssue } from "./types";
export * from "./media-probe-v3";
export * from "./media-resource-provider-v3";

/** Pure, deterministic object-key helpers shared by upload and derivative APIs. */
export {
  defaultObjectKey,
  derivativeObjectKey,
} from "./server/providers/types";
