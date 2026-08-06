export const runtime = "nodejs";

/** Retired — use POST /api/renders. */
export async function POST(): Promise<Response> {
  return Response.json(
    {
      error: "Local export jobs retired. Use POST /api/renders.",
      code: "EXPORT_JOBS_RETIRED",
    },
    { status: 410 },
  );
}
