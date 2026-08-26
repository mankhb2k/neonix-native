import { NextResponse } from "next/server";
import {
  loadProject,
  ProjectRepositoryError,
  saveProject,
} from "@/lib/editor/document/project-repository";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

function errorResponse(error: unknown) {
  if (!(error instanceof ProjectRepositoryError)) {
    return NextResponse.json(
      { error: "Unable to access project" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const status =
    error.code === "UNAUTHENTICATED"
      ? 401
      : error.code === "NOT_FOUND"
        ? 404
        : error.code === "INVALID_DOCUMENT"
          ? 422
          : error.code === "REVISION_CONFLICT"
            ? 409
            : 500;
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  try {
    return NextResponse.json(await loadProject(projectId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be an object", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }
  const input = body as {
    document?: unknown;
    expectedRevisionNo?: unknown;
  };
  const parsedDocument = MotionProtocolV2Schema.safeParse(input.document);
  if (!parsedDocument.success) {
    return NextResponse.json(
      { error: "document must be a valid Motion Protocol V2 object", code: "INVALID_DOCUMENT" },
      { status: 422 },
    );
  }
  if (
    typeof input.expectedRevisionNo !== "number" ||
    !Number.isInteger(input.expectedRevisionNo) ||
    input.expectedRevisionNo < 1
  ) {
    return NextResponse.json(
      { error: "expectedRevisionNo must be a positive integer", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await saveProject(
        projectId,
        parsedDocument.data,
        input.expectedRevisionNo,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
