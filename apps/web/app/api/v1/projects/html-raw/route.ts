import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import {
  createProjectHtmlRaw,
  ProjectRepositoryError,
} from "@/lib/server/projects/repository";
import {
  authenticatedProjectContext,
  projectErrorStatus,
} from "@/lib/server/projects/web-context";

// Kiến trúc B entry point (see ARCHITECHTURE.md "Hai kiến trúc render độc
// lập"): stores HTML/CSS as-is with no compile step. Do not call the HTML
// compiler here — that only happens on explicit "Convert JSON V2"
// (POST /api/v1/projects/[projectId]/convert-json).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body || typeof body.html !== "string" || body.html.trim().length === 0) {
    return jsonApiError(request, 400, "INVALID_INPUT", "html is required");
  }
  if (body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length === 0 || body.title.trim().length > 200)) {
    return jsonApiError(request, 400, "INVALID_INPUT", "title must be between 1 and 200 characters");
  }

  try {
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await createProjectHtmlRaw(client, actor, {
      workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      html: body.html,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof ProjectRepositoryError) {
      return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    }
    return jsonApiError(request, 500, "PROJECT_HTML_RAW_CREATE_FAILED", "Unable to create HTML project");
  }
}
