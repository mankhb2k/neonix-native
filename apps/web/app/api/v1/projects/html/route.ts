import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import {
  createProjectHtml,
  ProjectRepositoryError,
} from "@/lib/server/projects/repository";
import {
  authenticatedProjectContext,
  projectErrorStatus,
} from "@/lib/server/projects/web-context";

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
  if (body.idempotencyKey !== undefined && (typeof body.idempotencyKey !== "string" || body.idempotencyKey.trim().length === 0 || body.idempotencyKey.trim().length > 200)) {
    return jsonApiError(request, 400, "INVALID_INPUT", "idempotencyKey must be between 1 and 200 characters");
  }

  try {
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await createProjectHtml(client, actor, {
      workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      html: body.html,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof ProjectRepositoryError) {
      return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    }
    return jsonApiError(request, 500, "PROJECT_HTML_CREATE_FAILED", "Unable to create HTML project");
  }
}
