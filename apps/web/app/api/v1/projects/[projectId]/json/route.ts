import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import {
  applyJsonPatch,
  ProjectRepositoryError,
} from "@/lib/server/projects/repository";
import {
  authenticatedProjectContext,
  projectErrorStatus,
} from "@/lib/server/projects/web-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

export async function PATCH(request: Request, context: Context) {
  const body = await readJsonObject(request);
  if (!body || body.patch === undefined) return jsonApiError(request, 400, "INVALID_INPUT", "patch is required");
  if (!Number.isInteger(body.expectedProtocolRevisionNo) || Number(body.expectedProtocolRevisionNo) < 1) {
    return jsonApiError(request, 400, "INVALID_INPUT", "expectedProtocolRevisionNo must be a positive integer");
  }
  try {
    const { projectId } = await context.params;
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await applyJsonPatch(client, actor, {
      projectId,
      expectedProtocolRevisionNo: Number(body.expectedProtocolRevisionNo),
      patch: body.patch,
    }));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "JSON_PATCH_FAILED", "Unable to apply JSON patch");
  }
}

