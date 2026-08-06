import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Sync local FFmpeg export removed — production export is Remotion Lambda via POST /api/renders.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Local CLI export is retired. Use POST /api/renders (Remotion Lambda).",
      code: "EXPORT_ROUTE_RETIRED",
    },
    { status: 410 },
  );
}
