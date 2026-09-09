import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SYSTEM_ASSET_FALLBACK_IDS,
  systemAssetFallbackId,
} from "@/lib/media/system-asset-fallback";

export { SYSTEM_ASSET_FALLBACK_IDS } from "@/lib/media/system-asset-fallback";

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
  imagePlaceholder: SYSTEM_ASSET_FALLBACK_IDS.image,
  svgPlaceholder: SYSTEM_ASSET_FALLBACK_IDS.svg,
  videoPlaceholder: SYSTEM_ASSET_FALLBACK_IDS.video,
  audioSilence: SYSTEM_ASSET_FALLBACK_IDS.audio,
} as const;

export function systemAssetUrl(id: string, variant?: SystemAssetVariantKind): string {
  const query = variant && variant !== "origin" ? `?variant=${encodeURIComponent(variant)}` : "";
  return `/api/v1/system-assets/${encodeURIComponent(id)}${query}`;
}

export function fallbackSystemAssetId(kind: string, mimeType: string): string | null {
  if (kind === "image" || kind === "video" || kind === "audio") {
    return systemAssetFallbackId(kind, mimeType);
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
