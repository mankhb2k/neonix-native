import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import { createHtmlProject, HtmlProjectError, listHtmlProjects } from "@/lib/server/html-project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(code: HtmlProjectError["code"]): number {
  return code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "INVALID_DOCUMENT" ? 422 : 500;
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const title = typeof body?.title === "string" ? body.title : "Untitled project";
  const html = body?.html;
  if (typeof html !== "string" || html.trim().length === 0) {
    return jsonApiError(request, 400, "INVALID_INPUT", "html is required");
  }
  try {
    return jsonApi(request, await createHtmlProject({ title, html }), { status: 201 });
  } catch (error) {
    if (error instanceof HtmlProjectError) return jsonApiError(request, errorStatus(error.code), error.code, error.message);
    return jsonApiError(request, 500, "PROJECT_CREATE_FAILED", "Unable to create project");
  }
}

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "20");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonApiError(request, 400, "INVALID_INPUT", "limit must be an integer between 1 and 100");
  }
  try {
    return jsonApi(request, await listHtmlProjects(limit));
  } catch (error) {
    if (error instanceof HtmlProjectError) return jsonApiError(request, errorStatus(error.code), error.code, error.message);
    return jsonApiError(request, 500, "PROJECT_LIST_FAILED", "Unable to list projects");
  }
}
