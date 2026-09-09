import { jsonApi, jsonApiError } from "@/lib/server/api/v1";
import { getHtmlRevision, HtmlProjectError } from "@/lib/server/html-project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string; revisionNo: string }> };

export async function GET(request: Request, context: Context) {
  const { projectId, revisionNo: rawRevisionNo } = await context.params;
  const revisionNo = Number(rawRevisionNo);
  if (!Number.isInteger(revisionNo) || revisionNo < 1) {
    return jsonApiError(request, 400, "INVALID_INPUT", "revisionNo must be a positive integer");
  }
  try {
    return jsonApi(request, await getHtmlRevision(projectId, revisionNo));
  } catch (error) {
    if (error instanceof HtmlProjectError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "NOT_FOUND" ? 404 : 500;
      return jsonApiError(request, status, error.code, error.message);
    }
    return jsonApiError(request, 500, "REVISION_READ_FAILED", "Unable to read revision");
  }
}
