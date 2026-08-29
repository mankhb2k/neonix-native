import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Export is handled by the native VPS worker via POST /api/renders.
 */
export function POST() {
  return NextResponse.json(
    {
      error:
        "Use POST /api/renders for native VPS export.",
      code: "EXPORT_ROUTE_RETIRED",
    },
    { status: 410 },
  );
}
