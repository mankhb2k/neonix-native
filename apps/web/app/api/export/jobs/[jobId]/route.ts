export const runtime = "nodejs";

/** Retired — use GET/DELETE /api/renders/:id. */
export async function GET(): Promise<Response> {
  return Response.json(
    { error: "Use GET /api/renders/:id", code: "EXPORT_JOBS_RETIRED" },
    { status: 410 },
  );
}

export async function DELETE(): Promise<Response> {
  return Response.json(
    { error: "Use DELETE /api/renders/:id", code: "EXPORT_JOBS_RETIRED" },
    { status: 410 },
  );
}
