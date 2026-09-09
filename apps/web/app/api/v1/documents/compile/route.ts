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

  try {
    const result = compileHtmlDocument(html);
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
