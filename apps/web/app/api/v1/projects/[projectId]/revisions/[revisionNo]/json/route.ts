import { jsonApi, jsonApiError } from "@/lib/server/api/v1";
import {
  getProtocolRevision,
  ProjectRepositoryError,
} from "@/lib/server/projects/repository";
import {
  authenticatedProjectContext,
  projectErrorStatus,
} from "@/lib/server/projects/web-context";

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
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await getProtocolRevision(client, actor, { projectId, revisionNo }));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "PROTOCOL_REVISION_READ_FAILED", "Unable to read Neonix JSON V2 revision");
  }
}
