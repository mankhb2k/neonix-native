/* Supabase's schema client is intentionally untyped in this repository. */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Readable } from "node:stream";
import { getSystemAssetsProvider } from "@/lib/server/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ fontFileId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { fontFileId } = await params;
  const { data: dataValue, error } = await supabase.schema("system_catalog").from("font_files").select("id,r2_key,format,enabled").eq("id", fontFileId).eq("enabled", true).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const data = dataValue;
  if (!data) return Response.json({ error: "System font not found" }, { status: 404 });
  const provider = getSystemAssetsProvider();
  const head = await provider.headObject(data.r2_key);
  if (!head) return Response.json({ error: "System font object not found" }, { status: 404 });
  try {
    const object = await provider.getObjectStream(data.r2_key);
    if (!object.Body) return Response.json({ error: "System font body is empty" }, { status: 404 });
    const body = object.Body as { transformToWebStream?: () => ReadableStream<Uint8Array> };
    const stream = typeof body.transformToWebStream === "function" ? body.transformToWebStream() : Readable.toWeb(object.Body as import("node:stream").Readable) as ReadableStream<Uint8Array>;
    const mime = data.format === "woff2" ? "font/woff2" : data.format === "woff" ? "font/woff" : "font/ttf";
    return new Response(stream, { headers: { "Content-Type": head.contentType ?? mime, "Content-Length": String(head.sizeBytes), "Cache-Control": "private, max-age=3600" } });
  } catch { return Response.json({ error: "Unable to read system font" }, { status: 502 }); }
}
