import { Readable } from "node:stream";
import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";
import { derivativeObjectKey, getUserAssetsProvider } from "@/lib/server/r2";

export const runtime = "nodejs";

type MediaAssetRow = { id: string; r2_key: string; preview_key: string | null; mime_type: string; status: string };

function asMediaAssetRow(value: unknown): MediaAssetRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.r2_key === "string"
    && (record.preview_key === null || typeof record.preview_key === "string")
    && typeof record.mime_type === "string"
    && typeof record.status === "string"
    ? value as MediaAssetRow
    : null;
}

function parseVariant(request: Request): "original" | "audio" | "poster" {
  const value = new URL(request.url).searchParams.get("variant");
  return value === "audio" || value === "poster" ? value : "original";
}

function toWebBody(body: unknown): ReadableStream<Uint8Array> {
  const candidate = body as { transformToWebStream?: () => ReadableStream<Uint8Array> };
  if (typeof candidate.transformToWebStream === "function") return candidate.transformToWebStream();
  return Readable.toWeb(body as import("node:stream").Readable) as ReadableStream<Uint8Array>;
}

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);
  const { assetId } = await params;
  const { supabase, workspaceId } = result.context;
  const { data: rawAsset, error } = await supabase
    .from("assets")
    .select("id, r2_key, preview_key, mime_type, status")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  const asset = asMediaAssetRow(rawAsset);
  if (!asset || asset.status !== "ready") return jsonError("Asset not found", 404);

  const variant = parseVariant(request);
  let key = asset.r2_key;
  if (variant === "poster") {
    key = typeof asset.preview_key === "string" ? asset.preview_key : "";
  } else if (variant === "audio") {
    const { data: variants } = await supabase
      .from("asset_variants")
      .select("r2_key, variant_kind, metadata_json")
      .eq("asset_id", assetId);
    const canonicalAudioKey = derivativeObjectKey(assetId, "audio", "audio.m4a");
    const audioVariant = (variants ?? []).find((item: { r2_key?: unknown; variant_kind?: unknown; metadata_json?: unknown }) => {
      if (!(item.variant_kind === "audio" || item.variant_kind === "proxy") || typeof item.r2_key !== "string") return false;
      const metadata = item.metadata_json && typeof item.metadata_json === "object" ? item.metadata_json as Record<string, unknown> : {};
      // Keep the legacy path check while existing derivative rows are being
      // migrated. New derivatives use the canonical flat file name.
      return metadata.kind === "audio" || item.r2_key === canonicalAudioKey || item.r2_key.includes("/audio/");
    });
    key = typeof audioVariant?.r2_key === "string" ? audioVariant.r2_key : derivativeObjectKey(assetId, "audio", "audio.m4a");
  }

  const provider = getUserAssetsProvider();
  const head = await provider.headObject(key);
  if (!head) return jsonError(variant === "audio" ? "Audio derivative is not ready" : variant === "poster" ? "Poster is not ready" : "Asset not found", 404);
  const range = request.headers.get("range");
  let requestedRange = range ?? undefined;
  let status = 200;
  let contentLength = head.sizeBytes;
  let contentRange: string | undefined;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.sizeBytes}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, head.sizeBytes - Number(match[2] || 0));
    const end = match[2] ? Number(match[2]) : head.sizeBytes - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= head.sizeBytes) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.sizeBytes}` } });
    }
    const boundedEnd = Math.min(end, head.sizeBytes - 1);
    requestedRange = `bytes=${start}-${boundedEnd}`;
    contentLength = boundedEnd - start + 1;
    contentRange = `bytes ${start}-${boundedEnd}/${head.sizeBytes}`;
    status = 206;
  }
  try {
    const object = await provider.getObjectStream(key, requestedRange);
    if (!object.Body) return jsonError("Asset body is empty", 404);
    const headers = new Headers({ "Content-Type": head.contentType ?? asset.mime_type, "Content-Length": String(contentLength), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=60" });
    if (contentRange) headers.set("Content-Range", contentRange);
    return new Response(toWebBody(object.Body), { status, headers });
  } catch {
    return jsonError("Unable to read asset", 502);
  }
}
