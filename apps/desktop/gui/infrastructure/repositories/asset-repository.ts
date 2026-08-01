import type {
  DesktopAPI,
  ImportedAsset,
  ListMissingAssetsResult,
  RelinkAssetResult,
  ResolvedAsset,
} from "../../../shared/ipc/contracts";

export type AssetRepository = {
  importFiles(): Promise<ImportedAsset[]>;
  resolveUrl(input: {
    assetId: string;
    uri: string;
  }): Promise<ResolvedAsset>;
  relink(input: { assetId: string }): Promise<RelinkAssetResult>;
  listMissing(input: {
    assets: { id: string; uri: string }[];
  }): Promise<ListMissingAssetsResult>;
};

export function createAssetRepository(api: DesktopAPI): AssetRepository {
  return {
    importFiles: () => api.assets.importFiles(),
    resolveUrl: (input) => api.assets.resolveUrl(input),
    relink: (input) => api.assets.relink(input),
    listMissing: (input) => api.assets.listMissing(input),
  };
}
