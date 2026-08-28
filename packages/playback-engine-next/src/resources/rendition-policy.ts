export type RenditionV3 = { readonly id: string; readonly width?: number; readonly height?: number; readonly bitrate?: number; readonly url?: string };
export type RenditionPolicyV3 = { choose(renditions: readonly RenditionV3[], context?: { width?: number; height?: number; bandwidth?: number }): RenditionV3 | undefined };

export const createRenditionPolicyV3 = (): RenditionPolicyV3 => ({
  choose: (renditions, context) => {
    if (!renditions.length) return undefined;
    const target = context?.width ?? Number.POSITIVE_INFINITY;
    return [...renditions].filter((r) => !r.width || r.width <= target).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ?? renditions[0];
  },
});
