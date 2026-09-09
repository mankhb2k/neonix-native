import { jsonApi, jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import {
  createProject,
  listProjects,
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
  if (!body || typeof body.document !== "object" || body.document === null || Array.isArray(body.document)) {
    return jsonApiError(request, 400, "INVALID_INPUT", "document must be a Protocol V2 object");
  }
  try {
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await createProject(client, actor, {
      workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      document: body.document,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "PROJECT_CREATE_FAILED", "Unable to create project");
  }
}

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "20");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonApiError(request, 400, "INVALID_INPUT", "limit must be an integer between 1 and 100");
  }
  try {
    const { client, actor } = await authenticatedProjectContext();
    return jsonApi(request, await listProjects(client, actor, {
      limit,
      workspaceId: new URL(request.url).searchParams.get("workspaceId") ?? undefined,
    }));
  } catch (error) {
    if (error instanceof ProjectRepositoryError) return jsonApiError(request, projectErrorStatus(error.code), error.code, error.message, error.details);
    return jsonApiError(request, 500, "PROJECT_LIST_FAILED", "Unable to list projects");
  }
}
