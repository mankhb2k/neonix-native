export type {
  CreateUploadRequest,
  CreateUploadResponse,
  CompleteUploadResponse,
  DownloadUrlResponse,
  ValidateAssetsRequest,
  ValidateAssetsResponse,
  StoredAssetRecord,
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

export type { AssetValidationIssue } from "@motionvideo/motion-protocol";
