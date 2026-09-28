import { jsonApi, jsonApiError } from "@/lib/server/api/v1";
import {
  convertProjectHtmlToJson,
  ProjectRepositoryError,
} from "@/lib/server/projects/repository";
import {
  authenticatedProjectContext,
  projectErrorStatus,
} from "@/lib/server/projects/web-context";

// The "Convert JSON V2" action: on-demand bridge from a Kiến trúc B raw HTML
// project to a Kiến trúc A Neonix JSON V2 project. Compiles once and moves
// the project from current_revision_no === 0 to 1.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { projectId } = await context.params;
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await convertProjectHtmlToJson(client, actor, { projectId }));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) {
      return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    }
    return jsonApiError(request, 500, "PROJECT_HTML_CONVERT_FAILED", "Unable to convert project to Neonix JSON V2");
  }
}
