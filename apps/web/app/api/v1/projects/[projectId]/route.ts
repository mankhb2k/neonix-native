import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import {
  deleteProject,
  getProject,
  ProjectRepositoryError,
  updateProject,
} from "@/lib/server/projects/repository";
import {
  authenticatedProjectContext,
  projectErrorStatus,
} from "@/lib/server/projects/web-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

function reference(projectId: string) {
  return { projectId };
}
export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await getProject(client, actor, reference(projectId)));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "PROJECT_READ_FAILED", "Unable to read project");
  }
}

export async function PATCH(request: Request, context: Context) {
  const body = await readJsonObject(request);
  if (!body) return jsonApiError(request, 400, "INVALID_INPUT", "Request body must be an object");
  if (body.document === undefined && body.title === undefined) {
    return jsonApiError(request, 400, "INVALID_INPUT", "title or document is required");
  }
  if (body.document !== undefined && (typeof body.document !== "object" || body.document === null || Array.isArray(body.document))) {
    return jsonApiError(request, 400, "INVALID_INPUT", "document must be a Protocol V2 object");
  }
  if (body.expectedRevisionNo !== undefined && (!Number.isInteger(body.expectedRevisionNo) || Number(body.expectedRevisionNo) < 0)) {
    return jsonApiError(request, 400, "INVALID_INPUT", "expectedRevisionNo must be a non-negative integer");
  }
  try {
    const { projectId } = await context.params;
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await updateProject(client, actor, {
      projectId,
      title: typeof body.title === "string" ? body.title : undefined,
      document: body.document,
      expectedRevisionNo: typeof body.expectedRevisionNo === "number" ? body.expectedRevisionNo : undefined,
    }));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "PROJECT_UPDATE_FAILED", "Unable to update project");
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await deleteProject(client, actor, reference(projectId)));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "PROJECT_DELETE_FAILED", "Unable to delete project");
  }
}
