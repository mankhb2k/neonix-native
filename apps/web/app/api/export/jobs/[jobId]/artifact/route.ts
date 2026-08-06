export const runtime = "nodejs";

/** Retired — use GET /api/renders/:id/download. */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      error: "Use GET /api/renders/:id/download",
      code: "EXPORT_JOBS_RETIRED",
    },
    { status: 410 },
  );
}
