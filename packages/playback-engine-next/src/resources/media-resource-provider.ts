export type MediaResourceKindV3 = "video" | "audio" | "poster" | "preview";
export type MediaResourceV3 = { readonly url: string; readonly kind: MediaResourceKindV3; readonly expiresAtMs?: number; readonly headers?: Readonly<Record<string, string>> };
export type MediaResourceProviderV3 = {
  resolve(assetId: string, kind: MediaResourceKindV3, signal?: AbortSignal): Promise<MediaResourceV3>;
  refresh?(resource: MediaResourceV3, signal?: AbortSignal): Promise<MediaResourceV3>;
};
