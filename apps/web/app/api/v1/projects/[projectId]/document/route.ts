import { jsonApi, jsonApiError } from "@/lib/server/api/v1";
import { getHtmlProject, HtmlProjectError } from "@/lib/server/html-project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const result = await getHtmlProject(projectId);
    return jsonApi(request, { project: result.project, html: result.html });
  } catch (error) {
    if (error instanceof HtmlProjectError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 500;
      return jsonApiError(request, status, error.code, error.message);
    }
    return jsonApiError(request, 500, "DOCUMENT_READ_FAILED", "Unable to read document");
  }
}
