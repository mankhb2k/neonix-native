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
    const result = await compileHtmlDocument(html);
    const errors = result.diagnostics.filter((item) => item.severity === "error");
    return jsonApi(request, {
      valid: result.status === "success" && errors.length === 0,
      documentHash: await cryptoHash(html),
      composition: result.source.composition,
      diagnostics: result.diagnostics,
      stats: {
        layerCount: result.protocol?.layers.length ?? 0,
      },
    });
  } catch (error) {
    return jsonApiError(request, 500, "VALIDATION_FAILED", error instanceof Error ? error.message : "Unable to validate document");
  }
}

async function cryptoHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
