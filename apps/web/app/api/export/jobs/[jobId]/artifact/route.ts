export const runtime = "nodejs";

/** Retired — use GET /api/renders/:id/download. */
export function GET(): Response {
  return Response.json(
    {
      error: "Use GET /api/renders/:id/download",
      code: "EXPORT_JOBS_RETIRED",
    },
    { status: 410 },
  );
}
