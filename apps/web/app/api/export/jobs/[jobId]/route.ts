export const runtime = "nodejs";

/** Retired — use GET/DELETE /api/renders/:id. */
export function GET(): Response {
  return Response.json(
    { error: "Use GET /api/renders/:id", code: "EXPORT_JOBS_RETIRED" },
    { status: 410 },
  );
}

export function DELETE(): Response {
  return Response.json(
    { error: "Use DELETE /api/renders/:id", code: "EXPORT_JOBS_RETIRED" },
    { status: 410 },
  );
}
