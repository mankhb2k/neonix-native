import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import { compileHtmlDocument } from "@/lib/server/html-project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const html = body?.html;
  if (typeof html !== "string" || html.trim().length === 0) {
    return jsonApiError(request, 400, "INVALID_INPUT", "html is required");
  }
  const durationMs = body?.durationMs === undefined ? 1_000 : Number(body.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 86_400_000) {
    return jsonApiError(request, 400, "INVALID_INPUT", "durationMs must be a positive value up to 86400000");
  }

  try {
    const result = compileHtmlDocument(html, { composition: { durationMs } });
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
