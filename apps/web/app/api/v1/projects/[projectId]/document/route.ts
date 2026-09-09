import { jsonApi, jsonApiError } from "@/lib/server/api/v1";
import {
  getProjectHtml,
  ProjectRepositoryError,
} from "@/lib/server/projects/repository";
import {
  authenticatedProjectContext,
  projectErrorStatus,
} from "@/lib/server/projects/web-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

/** Compatibility alias for clients that still use /document. */
export async function GET(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { client, actor } = await authenticatedProjectContext();
    const result = await getProjectHtml(client, actor, { projectId });
    return jsonApi(request, { project: result.project, html: result.html, htmlRevision: result.htmlRevision });
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "DOCUMENT_READ_FAILED", "Unable to read document");
  }
}
