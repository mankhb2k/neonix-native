import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import { getHtmlProject, HtmlProjectError, saveHtmlProject } from "@/lib/server/html-project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

function errorStatus(code: HtmlProjectError["code"]): number {
  return code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "REVISION_CONFLICT" ? 409 : code === "INVALID_DOCUMENT" ? 422 : 500;
}

export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    return jsonApi(request, await getHtmlProject(projectId));
  } catch (error) {
    if (error instanceof HtmlProjectError) return jsonApiError(request, errorStatus(error.code), error.code, error.message);
    return jsonApiError(request, 500, "PROJECT_READ_FAILED", "Unable to read project");
  }
}

export async function PUT(request: Request, context: Context) {
  const body = await readJsonObject(request);
  const html = body?.html;
  const expectedRevisionNo = body?.expectedRevisionNo;
  if (typeof html !== "string" || html.trim().length === 0) return jsonApiError(request, 400, "INVALID_INPUT", "html is required");
  if (typeof expectedRevisionNo !== "number" || !Number.isInteger(expectedRevisionNo) || expectedRevisionNo < 0) {
    return jsonApiError(request, 400, "INVALID_INPUT", "expectedRevisionNo must be a non-negative integer");
  }
  try {
    const { projectId } = await context.params;
    return jsonApi(request, await saveHtmlProject({ projectRef: projectId, html, expectedRevisionNo }));
  } catch (error) {
    if (error instanceof HtmlProjectError) return jsonApiError(request, errorStatus(error.code), error.code, error.message);
    return jsonApiError(request, 500, "PROJECT_UPDATE_FAILED", "Unable to update project");
  }
}
