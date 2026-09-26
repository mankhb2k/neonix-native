import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import { compileHtmlDocument } from "@/lib/server/html-project-repository";
import { clientIpForRateLimit } from "@/lib/server/request-ip";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint is intentionally public and unauthenticated (used by the
// anonymous HTML playground), so it needs its own abuse controls instead of
// relying on any account/workspace quota.
const MAX_HTML_BYTES = 1_000_000; // 1 MB
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 20;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    return jsonApiError(request, 413, "PAYLOAD_TOO_LARGE", `Request body must not exceed ${MAX_HTML_BYTES} bytes`);
  }

  const ip = clientIpForRateLimit(request);
  try {
    const admin = createSupabaseAdminClient();
    const allowed = await admin.rpc("check_and_increment_rate_limit", {
      p_bucket_key: `documents-compile:${ip}`,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
    });
    if (allowed.error) throw allowed.error;
    if (allowed.data !== true) {
      return jsonApiError(request, 429, "RATE_LIMITED", "Too many compile requests. Please wait a moment and try again.");
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[documents/compile] rate limiting unavailable in this environment, allowing request", error);
    } else {
      // eslint-disable-next-line no-console
      console.error("[documents/compile] rate limit check failed", error);
      return jsonApiError(request, 503, "RATE_LIMIT_UNAVAILABLE", "Unable to verify request rate, please try again shortly");
    }
  }

  const body = await readJsonObject(request);
  const html = body?.html;
  if (typeof html !== "string" || html.trim().length === 0) {
    return jsonApiError(request, 400, "INVALID_INPUT", "html is required");
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return jsonApiError(request, 413, "PAYLOAD_TOO_LARGE", `html must not exceed ${MAX_HTML_BYTES} bytes`);
  }
  const durationMs = body?.durationMs === undefined ? 1_000 : Number(body.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 86_400_000) {
    return jsonApiError(request, 400, "INVALID_INPUT", "durationMs must be a positive value up to 86400000");
  }

  try {
    const result = await compileHtmlDocument(html, { composition: { durationMs } });
    const errors = result.diagnostics.filter((item) => item.severity === "error");
    if (result.status !== "success" || !result.protocol || errors.length > 0) {
      return jsonApiError(request, 422, "COMPILATION_FAILED", "HTML document could not be compiled", result.diagnostics);
    }
    return jsonApi(request, {
      status: "succeeded",
      protocolVersion: 2,
      composition: result.source.composition,
      protocol: result.protocol,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    return jsonApiError(request, 500, "COMPILATION_FAILED", error instanceof Error ? error.message : "Unable to compile document");
  }
}
