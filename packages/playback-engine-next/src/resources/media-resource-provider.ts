import type { RuntimeMediaResourceV3 } from "@motionvideo/motion-runtime";

/**
 * Backend boundary for late-bound URLs. RuntimeProjectV3 contains immutable
 * resource identity; tokens, signed URLs and range requests belong here.
 * This intentionally matches motion-storage's provider contract structurally.
 */
export type ResolvedMediaResourceV3 = { readonly uri: string; readonly expiresAt?: string; readonly headers?: Readonly<Record<string, string>> };
export type MediaResourceProviderV3 = {
  resolve(resource: RuntimeMediaResourceV3, signal?: AbortSignal): Promise<ResolvedMediaResourceV3>;
  refresh?(resource: RuntimeMediaResourceV3, signal?: AbortSignal): Promise<ResolvedMediaResourceV3>;
  chunk?(resource: RuntimeMediaResourceV3, start: number, end: number, signal?: AbortSignal): Promise<ArrayBuffer>;
};
