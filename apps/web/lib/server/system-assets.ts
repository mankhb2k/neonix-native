import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SystemAssetKind = "image" | "video" | "audio";
export type SystemAssetVariantKind = "origin" | "poster" | "audio" | "waveform" | "thumbnail";

export type SystemAssetRow = {
  id: string;
  parent_id: string | null;
  kind: SystemAssetKind;
  variant_kind: SystemAssetVariantKind;
  r2_key: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  metadata_json: Record<string, unknown>;
  enabled: boolean;
};

export const SYSTEM_ASSET_IDS = {
  imagePlaceholder: "system:image-placeholder",
  svgPlaceholder: "system:svg-placeholder",
  videoPlaceholder: "system:video-placeholder",
  audioSilence: "system:audio-silence",
} as const;

export function systemAssetUrl(id: string, variant?: SystemAssetVariantKind): string {
  const query = variant && variant !== "origin" ? `?variant=${encodeURIComponent(variant)}` : "";
  return `/api/v1/system-assets/${encodeURIComponent(id)}${query}`;
}

export function fallbackSystemAssetId(kind: string, mimeType: string): string | null {
  if (kind === "video") return SYSTEM_ASSET_IDS.videoPlaceholder;
  if (kind === "audio") return SYSTEM_ASSET_IDS.audioSilence;
  if (kind === "image") {
    return mimeType === "image/svg+xml"
      ? SYSTEM_ASSET_IDS.svgPlaceholder
      : SYSTEM_ASSET_IDS.imagePlaceholder;
  }
  return null;
}

export async function listSystemAssetCatalog(ids: string[]): Promise<SystemAssetRow[]> {
  if (ids.length === 0) return [];
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .schema("system_catalog")
    .from("system_assets")
    .select("id, parent_id, kind, variant_kind, r2_key, mime_type, byte_size, width, height, duration_ms, metadata_json, enabled")
    .in("id", ids)
    .eq("enabled", true);
  if (error) throw new Error(`Unable to read system asset catalog: ${error.message}`);
  return data ?? [];
}
