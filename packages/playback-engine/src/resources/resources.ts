import type { RuntimeMediaResourceV3 } from "@motionvideo/motion-runtime";

/**
 * Backend boundary for late-bound URLs. RuntimeProjectV3 contains immutable
 * resource identity; tokens, signed URLs and range requests belong here.
 * This intentionally matches the Web-owned media provider contract structurally.
 */
export type ResolvedMediaResourceV3 = { readonly uri: string; readonly expiresAt?: string; readonly headers?: Readonly<Record<string, string>> };
export type MediaResourceProviderV3 = {
  resolve(resource: RuntimeMediaResourceV3, signal?: AbortSignal): Promise<ResolvedMediaResourceV3>;
  refresh?(resource: RuntimeMediaResourceV3, signal?: AbortSignal): Promise<ResolvedMediaResourceV3>;
  chunk?(resource: RuntimeMediaResourceV3, start: number, end: number, signal?: AbortSignal): Promise<ArrayBuffer>;
};

export type RenditionV3 = { readonly id: string; readonly width?: number; readonly height?: number; readonly bitrate?: number; readonly url?: string };
export type RenditionPolicyV3 = { choose(renditions: readonly RenditionV3[], context?: { width?: number; height?: number; bandwidth?: number }): RenditionV3 | undefined };

export const createRenditionPolicyV3 = (): RenditionPolicyV3 => ({
  choose: (renditions, context) => {
    if (!renditions.length) return undefined;
    const target = context?.width ?? Number.POSITIVE_INFINITY;
    return [...renditions].filter((r) => !r.width || r.width <= target).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ?? renditions[0];
  },
});

export type ResourceLeaseV3<T> = { readonly value: T; release(): void; readonly released: boolean };

export function createResourceLeaseV3<T>(value: T, onRelease?: () => void): ResourceLeaseV3<T> {
  let released = false;
  return { value, get released() { return released; }, release() { if (released) return; released = true; onRelease?.(); } };
}
