import { jsonApi, jsonApiError } from "@/lib/server/api/v1";
import { listHtmlRevisions, HtmlProjectError } from "@/lib/server/html-project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    return jsonApi(request, await listHtmlRevisions(projectId));
  } catch (error) {
    if (error instanceof HtmlProjectError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "NOT_FOUND" ? 404 : 500;
      return jsonApiError(request, status, error.code, error.message);
    }
    return jsonApiError(request, 500, "REVISION_LIST_FAILED", "Unable to list revisions");
  }
}
