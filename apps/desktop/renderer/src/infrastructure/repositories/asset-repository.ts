import type {
  DesktopAPI,
  ImportedAsset,
  ListMissingAssetsResult,
  RelinkAssetResult,
  ResolvedAsset,
} from "../../../../src/shared/ipc/contracts";

export type AssetRepository = {
  importFiles(input: {
    projectPath: string;
    paths?: string[];
  }): Promise<ImportedAsset[]>;
  resolveUrl(input: {
    projectPath: string;
    assetId: string;
    uri: string;
  }): Promise<ResolvedAsset>;
  relink(input: {
    projectPath: string;
    assetId: string;
    newPath?: string;
  }): Promise<RelinkAssetResult>;
  listMissing(input: {
    projectPath: string;
    assets: { id: string; uri: string }[];
  }): Promise<ListMissingAssetsResult>;
};

export function createAssetRepository(api: DesktopAPI): AssetRepository {
  return {
    importFiles: (input) => api.assets.importFiles(input),
    resolveUrl: (input) => api.assets.resolveUrl(input),
    relink: (input) => api.assets.relink(input),
    listMissing: (input) => api.assets.listMissing(input),
  };
}
