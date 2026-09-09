import { jsonApi, jsonApiError } from "@/lib/server/api/v1";
import {
  listHtmlRevisions,
  ProjectRepositoryError,
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
    return jsonApi(request, await listHtmlRevisions(client, actor, { projectId }));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "REVISION_LIST_FAILED", "Unable to list revisions");
  }
}
