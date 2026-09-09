import { NextResponse } from "next/server";
import {
  attachProjectAsset,
  ProjectRepositoryError,
} from "@/lib/editor/document/project-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

function errorResponse(error: unknown) {
  if (!(error instanceof ProjectRepositoryError)) {
    return NextResponse.json({ error: "Unable to attach asset to project" }, { status: 500 });
  }

  const status =
    error.code === "UNAUTHENTICATED"
      ? 401
      : error.code === "NOT_FOUND"
        ? 404
        : 500;
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const assetId =
    body && typeof body === "object" && "assetId" in body
      ? (body as { assetId?: unknown }).assetId
      : undefined;
  if (typeof assetId !== "string" || assetId.trim().length === 0) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }

  const { projectId } = await context.params;
  try {
    await attachProjectAsset(projectId, assetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}


