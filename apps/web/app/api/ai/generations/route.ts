import {
  compileAtomicProtocolV2,
  validateAtomicProtocolV2,
} from "@motionvideo/ai-planner";

export const runtime = "nodejs";

/**
 * AI generation is intentionally paused while V2 atoms are certified. This
 * route still accepts an existing Protocol V2 document for validation and
 * compiler smoke checks.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { project?: unknown };
  try {
    body = (await request.json()) as { project?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.project === undefined) {
    return Response.json(
      {
        ok: false,
        error: "High-level AI authoring is paused until Protocol V2 atoms are certified",
      },
      { status: 501 },
    );
  }

  const validation = validateAtomicProtocolV2(body.project);
  if (!validation.valid || !validation.project) {
    return Response.json({ ok: false, diagnostics: validation.diagnostics }, { status: 400 });
  }

  try {
    const runtimeProject = compileAtomicProtocolV2(validation.project);
    return Response.json({ ok: true, project: validation.project, runtimeProject });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
