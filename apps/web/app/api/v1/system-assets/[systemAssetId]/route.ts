import { Readable } from "node:stream";
import { getSystemAssetsProvider } from "@/lib/server/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SystemAssetRow = {
  id: string;
  parent_id: string | null;
  variant_kind: "origin" | "poster" | "audio" | "waveform" | "thumbnail";
  r2_key: string;
  mime_type: string;
};

function toWebBody(body: unknown): ReadableStream<Uint8Array> {
  const candidate = body as { transformToWebStream?: () => ReadableStream<Uint8Array> };
  if (typeof candidate.transformToWebStream === "function") return candidate.transformToWebStream();
  return Readable.toWeb(body as import("node:stream").Readable) as ReadableStream<Uint8Array>;
}

function asSystemAssetRow(value: unknown): SystemAssetRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const variant = record.variant_kind;
  return typeof record.id === "string"
    && (record.parent_id === null || typeof record.parent_id === "string")
    && (variant === "origin" || variant === "poster" || variant === "audio" || variant === "waveform" || variant === "thumbnail")
    && typeof record.r2_key === "string"
    && typeof record.mime_type === "string"
    ? {
        id: record.id,
        parent_id: record.parent_id,
        variant_kind: variant,
        r2_key: record.r2_key,
        mime_type: record.mime_type,
      }
    : null;
}

function parseVariant(request: Request): SystemAssetRow["variant_kind"] {
  const value = new URL(request.url).searchParams.get("variant");
  return value === "poster" || value === "audio" || value === "waveform" || value === "thumbnail"
    ? value
    : "origin";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ systemAssetId: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const { systemAssetId } = await params;
  const variant = parseVariant(request);
  let query = supabase
    .schema("system_catalog")
    .from("system_assets")
    .select("id, parent_id, variant_kind, r2_key, mime_type")
    .eq("enabled", true);
  query = variant === "origin"
    ? query.eq("id", systemAssetId).eq("variant_kind", "origin")
    : query.eq("parent_id", systemAssetId).eq("variant_kind", variant);

  const { data, error } = await query.maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const asset = asSystemAssetRow(data);
  if (!asset) return Response.json({ error: "System asset not found" }, { status: 404 });

  const provider = getSystemAssetsProvider();
  const head = await provider.headObject(asset.r2_key);
  if (!head) return Response.json({ error: "System asset object not found" }, { status: 404 });

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
    const object = await provider.getObjectStream(asset.r2_key, requestedRange);
    if (!object.Body) return Response.json({ error: "System asset body is empty" }, { status: 404 });
    const headers = new Headers({
      "Content-Type": head.contentType ?? asset.mime_type,
      "Content-Length": String(contentLength),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    });
    if (contentRange) headers.set("Content-Range", contentRange);
    return new Response(toWebBody(object.Body), { status, headers });
  } catch {
    return Response.json({ error: "Unable to read system asset" }, { status: 502 });
  }
}


