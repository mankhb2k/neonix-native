import { POST as createRender } from "@/app/api/v1/renders/route";
import { jsonApiError, readJsonObject } from "@/lib/server/api/v1";
import { compileHtmlDocument, getHtmlProject, HtmlProjectError } from "@/lib/server/html-project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  const body = await readJsonObject(request);
  try {
    const project = await getHtmlProject(projectId);
    if (!project.html) return jsonApiError(request, 404, "DOCUMENT_NOT_FOUND", "Project has no HTML document");
    const compiled = compileHtmlDocument(project.html);
    const errors = compiled.diagnostics.filter((item) => item.severity === "error");
    if (compiled.status !== "success" || !compiled.protocol || errors.length > 0) {
      return jsonApiError(request, 422, "COMPILATION_FAILED", "Project document could not be compiled", compiled.diagnostics);
    }

    const forwarded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({
        projectId: project.project.id,
        projectRevision: project.project.currentRevisionNo,
        preset: typeof body?.preset === "string" ? body.preset : "export-1080p",
        idempotencyKey: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : undefined,
        document: compiled.protocol,
      }),
    });
    return createRender(forwarded);
  } catch (error) {
    if (error instanceof HtmlProjectError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 500;
      return jsonApiError(request, status, error.code, error.message);
    }
    return jsonApiError(request, 500, "RENDER_CREATE_FAILED", "Unable to create render");
  }
}
