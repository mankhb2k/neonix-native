import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import {
  getProjectHtml,
  ProjectRepositoryError,
  updateProjectHtml,
} from "@/lib/server/projects/repository";
import {
  authenticatedProjectContext,
  projectErrorStatus,
} from "@/lib/server/projects/web-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await getProjectHtml(client, actor, { projectId }));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "HTML_READ_FAILED", "Unable to read HTML source");
  }
}

export async function PUT(request: Request, context: Context) {
  const body = await readJsonObject(request);
  if (!body || typeof body.html !== "string" || body.html.trim().length === 0) {
    return jsonApiError(request, 400, "INVALID_INPUT", "html is required");
  }
  const expectedHtmlRevisionNo = body.expectedHtmlRevisionNo;
  const expectedProtocolRevisionNo = body.expectedProtocolRevisionNo;
  if (expectedHtmlRevisionNo !== undefined && (!Number.isInteger(expectedHtmlRevisionNo) || Number(expectedHtmlRevisionNo) < 0)) {
    return jsonApiError(request, 400, "INVALID_INPUT", "expectedHtmlRevisionNo must be a non-negative integer");
  }
  if (expectedProtocolRevisionNo !== undefined && (!Number.isInteger(expectedProtocolRevisionNo) || Number(expectedProtocolRevisionNo) < 0)) {
    return jsonApiError(request, 400, "INVALID_INPUT", "expectedProtocolRevisionNo must be a non-negative integer");
  }
  try {
    const { projectId } = await context.params;
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await updateProjectHtml(client, actor, {
      projectId,
      html: body.html,
      expectedHtmlRevisionNo: typeof expectedHtmlRevisionNo === "number" ? expectedHtmlRevisionNo : undefined,
      expectedProtocolRevisionNo: typeof expectedProtocolRevisionNo === "number" ? expectedProtocolRevisionNo : undefined,
    }));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "HTML_UPDATE_FAILED", "Unable to update HTML source");
  }
}

