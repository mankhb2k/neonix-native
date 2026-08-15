import type { AssetV1 } from "@motionvideo/motion-protocol";

/**
 * Sync resolver used by the compiler. Callers batch download URLs from the
 * Asset API, then pass a map lookup.
 */
export type AssetUrlResolver = (assetId: string) => string | undefined;

export function isManagedAsset(asset: AssetV1): boolean {
  return asset.storage?.managed === true;
}

/**
 * Resolve the ephemeral URI for compile/export.
 * Managed assets require `resolver`; unmanaged assets use authoring `uri`.
 */
export function resolveAssetUri(
  asset: AssetV1,
  resolver?: AssetUrlResolver,
): string | undefined {
  if (isManagedAsset(asset)) {
    return resolver?.(asset.id);
  }
  return asset.uri;
}

export function resolveProjectAssetUris(
  assets: AssetV1[],
  resolver: AssetUrlResolver,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const asset of assets) {
    const uri = resolveAssetUri(asset, resolver);
    if (uri) out.set(asset.id, uri);
  }
  return out;
}

export function createMapAssetUrlResolver(
  urls: ReadonlyMap<string, string> | Record<string, string>,
): AssetUrlResolver {
  const map = urls instanceof Map ? urls : new Map(Object.entries(urls));
  return (assetId) => map.get(assetId);
}
